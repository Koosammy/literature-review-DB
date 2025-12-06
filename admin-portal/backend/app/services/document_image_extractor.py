import io
import os
import uuid
from pathlib import Path
from typing import List, Tuple, Optional
import tempfile
from sqlalchemy.orm import Session
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend
import pandas as pd
import numpy as np
import re

from .database_image_service import DatabaseImageService

# Enhanced imports for better table extraction
try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False
    print("Warning: pdfplumber not available. Install with: pip install pdfplumber")

try:
    import camelot
    CAMELOT_AVAILABLE = True
except ImportError:
    CAMELOT_AVAILABLE = False
    print("Warning: camelot not available. Install with: pip install camelot-py[cv]")

try:
    import plotly.graph_objects as go
    import plotly.io as pio
    PLOTLY_AVAILABLE = True
except ImportError:
    PLOTLY_AVAILABLE = False
    print("Warning: plotly not available. Install with: pip install plotly")

try:
    import cv2
    import fitz  # PyMuPDF
    CV2_AVAILABLE = True
except ImportError:
    CV2_AVAILABLE = False
    print("Warning: opencv-python not available. Install with: pip install opencv-python")


class DocumentImageExtractor:
    def __init__(self, db_image_service: DatabaseImageService):
        self.db_image_service = db_image_service
        self.min_image_size = 5000  # Minimum 5KB to filter out tiny images
        self.min_table_rows = 2  # Minimum rows for a valid table
        self.min_table_cols = 2  # Minimum columns for a valid table
        self.min_data_diversity = 0.3  # Minimum ratio of unique values to total cells
        
        # PDFPlumber specific settings
        self.pdfplumber_settings = {
            'vertical_strategy': 'text',
            'horizontal_strategy': 'text',
            'explicit_vertical_lines': [],
            'explicit_horizontal_lines': [],
            'snap_tolerance': 5,
            'join_tolerance': 5,
            'edge_min_length': 3,
            'min_words_vertical': 3,
            'min_words_horizontal': 1,
        }
    
    async def extract_images_from_document(
        self, 
        document_data: bytes, 
        filename: str, 
        project_id: int,
        db: Session,
        extract_tables: bool = True
    ) -> int:
        """Extract images and tables from document and save to database."""
        file_ext = Path(filename).suffix.lower()
        
        if file_ext == '.pdf':
            return await self._extract_from_pdf_enhanced(
                document_data, project_id, db, extract_tables
            )
        elif file_ext in ['.docx', '.doc']:
            return await self._extract_from_docx_enhanced(
                document_data, project_id, db, extract_tables
            )
        else:
            return 0
    
    async def _extract_from_pdf_enhanced(
        self, 
        pdf_data: bytes, 
        project_id: int, 
        db: Session, 
        extract_tables: bool = True
    ) -> int:
        """Enhanced PDF extraction with PDFPlumber as primary method"""
        extracted_count = 0
        
        try:
            # Save PDF temporarily
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
                tmp_file.write(pdf_data)
                tmp_path = tmp_file.name
            
            try:
                # Get current image count for ordering
                from ..models.project import ProjectImage
                current_count = db.query(ProjectImage).filter(ProjectImage.project_id == project_id).count()
                
                # Extract regular images first
                extracted_count += await self._extract_regular_images(
                    pdf_data, project_id, db, current_count
                )
                
                # Extract tables using PDFPlumber as primary method
                if extract_tables:
                    tables_extracted = await self._extract_tables_with_pdfplumber(
                        tmp_path, project_id, db, current_count + extracted_count
                    )
                    extracted_count += tables_extracted
                    
                    # If PDFPlumber didn't find enough tables, try fallback methods
                    if tables_extracted < 2:
                        print("PDFPlumber found few tables, trying fallback methods...")
                        fallback_tables = await self._extract_tables_fallback(
                            tmp_path, project_id, db, current_count + extracted_count
                        )
                        extracted_count += fallback_tables
                
                print(f"Successfully extracted {extracted_count} images and tables from PDF")
                
            finally:
                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            
        except Exception as e:
            print(f"Error extracting from PDF: {e}")
            import traceback
            traceback.print_exc()
        
        return extracted_count
    
    async def _extract_regular_images(
        self, pdf_data: bytes, project_id: int, db: Session, start_index: int
    ) -> int:
        """Extract regular images from PDF"""
        extracted_count = 0
        
        try:
            import fitz
            pdf_document = fitz.open(stream=pdf_data, filetype="pdf")
            
            for page_num in range(len(pdf_document)):
                page = pdf_document.load_page(page_num)
                image_list = page.get_images()
                
                for img_index, img in enumerate(image_list):
                    try:
                        xref = img[0]
                        base_image = pdf_document.extract_image(xref)
                        image_bytes = base_image["image"]
                        
                        if len(image_bytes) < self.min_image_size:
                            continue
                        
                        ext = base_image.get('ext', 'png')
                        filename = f"figure_p{page_num + 1}_img{img_index + 1}.{ext}"
                        
                        await self.db_image_service.save_image_bytes_to_db(
                            image_bytes=image_bytes,
                            filename=filename,
                            project_id=project_id,
                            db=db,
                            order_index=start_index + extracted_count,
                            is_featured=(start_index == 0 and extracted_count == 0)
                        )
                        
                        extracted_count += 1
                        
                    except Exception as e:
                        print(f"Failed to extract image {img_index} from page {page_num}: {e}")
                        continue
            
            pdf_document.close()
            
        except Exception as e:
            print(f"Error extracting regular images: {e}")
        
        return extracted_count
    
    async def _extract_tables_with_pdfplumber(
        self, 
        pdf_path: str, 
        project_id: int, 
        db: Session, 
        start_index: int
    ) -> int:
        """Extract tables using PDFPlumber as primary method with enhanced settings"""
        tables_count = 0
        
        if not PDFPLUMBER_AVAILABLE:
            print("PDFPlumber not available, skipping table extraction")
            return 0
        
        try:
            with pdfplumber.open(pdf_path) as pdf:
                print(f"Extracting tables from {len(pdf.pages)} pages using PDFPlumber...")
                
                for page_num, page in enumerate(pdf.pages):
                    try:
                        # Get page dimensions and edges for better table detection
                        page_width = page.width
                        page_height = page.height
                        edges = page.edges + page.curves
                        
                        # Update settings with page-specific information
                        settings = self.pdfplumber_settings.copy()
                        settings.update({
                            'explicit_vertical_lines': edges,
                            'explicit_horizontal_lines': edges,
                        })
                        
                        # Extract tables with multiple strategies
                        tables = []
                        
                        # Strategy 1: Text-based extraction (most reliable)
                        try:
                            text_tables = page.extract_tables(settings)
                            tables.extend(text_tables)
                        except Exception as e:
                            print(f"Text-based extraction failed on page {page_num + 1}: {e}")
                        
                        # Strategy 2: Line-based extraction (for bordered tables)
                        if len(tables) == 0:
                            try:
                                line_settings = settings.copy()
                                line_settings.update({
                                    'vertical_strategy': 'lines',
                                    'horizontal_strategy': 'lines',
                                })
                                line_tables = page.extract_tables(line_settings)
                                tables.extend(line_tables)
                            except Exception as e:
                                print(f"Line-based extraction failed on page {page_num + 1}: {e}")
                        
                        # Strategy 3: Mixed strategy
                        if len(tables) == 0:
                            try:
                                mixed_settings = settings.copy()
                                mixed_settings.update({
                                    'vertical_strategy': 'mixed',
                                    'horizontal_strategy': 'mixed',
                                })
                                mixed_tables = page.extract_tables(mixed_settings)
                                tables.extend(mixed_tables)
                            except Exception as e:
                                print(f"Mixed strategy extraction failed on page {page_num + 1}: {e}")
                        
                        # Process extracted tables
                        for idx, table in enumerate(tables):
                            if not table or len(table) < 2:
                                continue
                            
                            # Convert to DataFrame
                            try:
                                # Use first row as header if it looks like headers
                                if len(table) > 1:
                                    df = pd.DataFrame(table[1:], columns=table[0])
                                else:
                                    df = pd.DataFrame(table)
                                
                                # Clean and validate table
                                df = self._clean_table(df)
                                
                                if self._is_valid_table_enhanced(df):
                                    # Save table as image
                                    saved = await self._save_table_as_image(
                                        df, project_id, db, start_index + tables_count,
                                        f"pdfplumber_p{page_num + 1}_t{idx + 1}"
                                    )
                                    if saved:
                                        tables_count += 1
                                        print(f"Extracted table {tables_count} from page {page_num + 1}")
                                
                            except Exception as e:
                                print(f"Failed to process table {idx} on page {page_num + 1}: {e}")
                                continue
                    
                    except Exception as e:
                        print(f"Error processing page {page_num + 1}: {e}")
                        continue
                
                print(f"PDFPlumber extracted {tables_count} tables")
                
        except Exception as e:
            print(f"Error in PDFPlumber table extraction: {e}")
            import traceback
            traceback.print_exc()
        
        return tables_count
    
    async def _extract_tables_fallback(
        self, 
        pdf_path: str, 
        project_id: int, 
        db: Session, 
        start_index: int
    ) -> int:
        """Fallback table extraction methods when PDFPlumber fails"""
        tables_count = 0
        
        # Try Camelot first
        if CAMELOT_AVAILABLE:
            try:
                tables_count += await self._extract_tables_with_camelot(
                    pdf_path, project_id, db, start_index + tables_count
                )
                print(f"Camelot extracted {tables_count} additional tables")
            except Exception as e:
                print(f"Camelot fallback failed: {e}")
        
        # Try OpenCV if still few tables
        if CV2_AVAILABLE and tables_count < 2:
            try:
                opencv_tables = await self._detect_tables_with_opencv(
                    pdf_path, project_id, db, start_index + tables_count
                )
                tables_count += opencv_tables
                print(f"OpenCV detected {opencv_tables} additional tables")
            except Exception as e:
                print(f"OpenCV fallback failed: {e}")
        
        return tables_count
    
    async def _extract_tables_with_camelot(
        self, 
        pdf_path: str, 
        project_id: int, 
        db: Session, 
        start_index: int
    ) -> int:
        """Extract tables using Camelot as fallback"""
        tables_count = 0
        
        try:
            # Try lattice method first (better for bordered tables)
            tables_lattice = camelot.read_pdf(
                pdf_path, 
                pages='all',
                flavor='lattice',
                suppress_stdout=True,
                split_text=True
            )
            
            for i, table in enumerate(tables_lattice):
                df = table.df
                if self._is_valid_table_enhanced(df):
                    saved = await self._save_table_as_image(
                        df, project_id, db, start_index + tables_count,
                        f"camelot_lattice_{i + 1}"
                    )
                    if saved:
                        tables_count += 1
            
            # Try stream method if lattice didn't find many tables
            if tables_count < 2:
                tables_stream = camelot.read_pdf(
                    pdf_path, 
                    pages='all',
                    flavor='stream',
                    suppress_stdout=True,
                    split_text=True
                )
                
                for i, table in enumerate(tables_stream):
                    df = table.df
                    if self._is_valid_table_enhanced(df):
                        saved = await self._save_table_as_image(
                            df, project_id, db, start_index + tables_count,
                            f"camelot_stream_{i + 1}"
                        )
                        if saved:
                            tables_count += 1
        
        except Exception as e:
            print(f"Camelot extraction failed: {e}")
        
        return tables_count
    
    async def _detect_tables_with_opencv(
        self, 
        pdf_path: str, 
        project_id: int, 
        db: Session, 
        start_index: int
    ) -> int:
        """Detect tables using OpenCV for visual table detection"""
        tables_count = 0
        
        try:
            pdf_document = fitz.open(pdf_path)
            
            for page_num in range(len(pdf_document)):
                page = pdf_document.load_page(page_num)
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # Higher resolution
                img_data = pix.tobytes("png")
                
                # Convert to OpenCV format
                nparr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                # Preprocess for table detection
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
                
                # Detect horizontal and vertical lines
                horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
                horizontal_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel, iterations=2)
                
                vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
                vertical_lines = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel, iterations=2)
                
                # Combine lines
                table_mask = cv2.addWeighted(horizontal_lines, 0.5, vertical_lines, 0.5, 0.0)
                
                # Find contours
                contours, _ = cv2.findContours(table_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                
                # Process each potential table
                for i, cnt in enumerate(contours):
                    x, y, w, h = cv2.boundingRect(cnt)
                    
                    # Filter by size
                    if w < 100 or h < 100 or w/h < 1.5:
                        continue
                    
                    # Extract table region
                    table_img = img[y:y+h, x:x+w]
                    
                    # Convert to image and save
                    _, buffer = cv2.imencode('.png', table_img)
                    table_image_bytes = buffer.tobytes()
                    
                    filename = f"table_cv2_page{page_num + 1}_{i + 1}.png"
                    await self.db_image_service.save_image_bytes_to_db(
                        image_bytes=table_image_bytes,
                        filename=filename,
                        project_id=project_id,
                        db=db,
                        order_index=start_index + tables_count,
                        is_featured=False
                    )
                    tables_count += 1
            
            pdf_document.close()
            
        except Exception as e:
            print(f"Error in OpenCV table detection: {e}")
        
        return tables_count
    
    def _is_valid_table_enhanced(self, df: pd.DataFrame) -> bool:
        """Enhanced table validation with sophisticated checks"""
        if df is None or df.empty:
            return False
        
        # Check minimum dimensions
        if df.shape[0] < self.min_table_rows or df.shape[1] < self.min_table_cols:
            return False
        
        # Check if table has meaningful content
        non_null_ratio = df.notna().sum().sum() / (df.shape[0] * df.shape[1])
        if non_null_ratio < 0.3:  # At least 30% non-null values
            return False
        
        # Check for data diversity
        total_cells = df.shape[0] * df.shape[1]
        unique_values = df.nunique().sum()
        if unique_values / total_cells < self.min_data_diversity:
            return False
        
        # Check for common table patterns
        # Pattern 1: First row has headers (different from other rows)
        if df.shape[0] > 1:
            first_row_unique = df.iloc[0].nunique()
            other_rows_avg_unique = df.iloc[1:].apply(lambda row: row.nunique(), axis=1).mean()
            
            # Headers should be more diverse than data rows
            if first_row_unique > other_rows_avg_unique * 1.5:
                return True
        
        # Pattern 2: Contains numeric data
        numeric_cols = df.select_dtypes(include=['number']).shape[1]
        if numeric_cols > 0:
            return True
        
        # Pattern 3: Contains date-like strings
        date_pattern = r'\d{1,4}[-/]\d{1,2}[-/]\d{1,4}'
        if df.applymap(lambda x: bool(re.search(date_pattern, str(x)))).any().any():
            return True
        
        # Pattern 4: Contains common table keywords
        table_keywords = ['total', 'sum', 'average', 'count', 'percentage', '%', 'rate', 'ratio']
        df_str = df.astype(str).lower()
        if any(keyword in df_str.values for keyword in table_keywords):
            return True
        
        return False
    
    def _clean_table(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clean and format table data"""
        # Replace NaN with empty string
        df = df.fillna('')
        
        # Convert all cells to string
        df = df.astype(str)
        
        # Remove extra whitespace
        df = df.applymap(lambda x: ' '.join(x.split()) if isinstance(x, str) else x)
        
        # Remove rows that are completely empty
        df = df[~(df == '').all(axis=1)]
        
        # Remove columns that are completely empty
        df = df.loc[:, ~(df == '').all(axis=0)]
        
        # Remove duplicate rows
        df = df.drop_duplicates()
        
        # Reset index
        df = df.reset_index(drop=True)
        
        return df
    
    async def _save_table_as_image(
        self, 
        df: pd.DataFrame, 
        project_id: int, 
        db: Session, 
        order_index: int,
        table_name: str
    ) -> int:
        """Save table as image using the best available method"""
        try:
            # Clean table first
            df = self._clean_table(df)
            
            # Try Plotly first (better formatting)
            if PLOTLY_AVAILABLE:
                table_image_bytes = await self._table_to_image_plotly(df, table_name)
                if table_image_bytes:
                    filename = f"table_{table_name}.png"
                    await self.db_image_service.save_image_bytes_to_db(
                        image_bytes=table_image_bytes,
                        filename=filename,
                        project_id=project_id,
                        db=db,
                        order_index=order_index,
                        is_featured=False
                    )
                    return 1
            
            # Fallback to matplotlib
            table_image_bytes = await self._table_to_image_matplotlib(df, table_name)
            if table_image_bytes:
                filename = f"table_{table_name}.png"
                await self.db_image_service.save_image_bytes_to_db(
                    image_bytes=table_image_bytes,
                    filename=filename,
                    project_id=project_id,
                    db=db,
                    order_index=order_index,
                    is_featured=False
                )
                return 1
            
        except Exception as e:
            print(f"Error saving table {table_name} as image: {e}")
        
        return 0
    
    async def _table_to_image_plotly(self, df: pd.DataFrame, table_name: str) -> Optional[bytes]:
        """Convert DataFrame to image using Plotly for better formatting"""
        try:
            # Create figure with enhanced styling
            fig = go.Figure(data=[go.Table(
                header=dict(
                    values=list(df.columns),
                    fill_color='rgba(46, 134, 171, 0.8)',
                    align='left',
                    font=dict(color='white', size=14, family="Arial, sans-serif"),
                    height=40
                ),
                cells=dict(
                    values=[df[col] for col in df.columns],
                    fill_color='rgba(240, 240, 240, 0.7)',
                    align='left',
                    font=dict(color='black', size=12, family="Arial, sans-serif"),
                    height=30
                )
            )])
            
            # Update layout with better styling
            fig.update_layout(
                title=dict(
                    text=f"Table: {table_name}",
                    x=0.5,
                    font=dict(size=18, family="Arial, sans-serif", color='#2c3e50')
                ),
                margin=dict(l=10, r=10, t=50, b=10),
                height=max(300, len(df) * 35 + 100),
                width=1200,
                plot_bgcolor='white',
                paper_bgcolor='white'
            )
            
            # Convert to image with high quality
            img_bytes = pio.to_image(
                fig, 
                format="png", 
                width=1200, 
                height=max(300, len(df) * 35 + 100),
                scale=2
            )
            
            return img_bytes
            
        except Exception as e:
            print(f"Error converting table to image with Plotly: {e}")
            return None
    
    async def _table_to_image_matplotlib(self, df: pd.DataFrame, table_name: str) -> Optional[bytes]:
        """Convert DataFrame to image using matplotlib (fallback method)"""
        try:
            import matplotlib.pyplot as plt
            
            # Calculate figure size based on table dimensions
            n_rows, n_cols = df.shape
            cell_width = 2.5
            cell_height = 0.5
            fig_width = max(10, min(20, n_cols * cell_width))
            fig_height = max(4, min(15, (n_rows + 2) * cell_height))
            
            # Create figure
            fig, ax = plt.subplots(figsize=(fig_width, fig_height))
            ax.axis('tight')
            ax.axis('off')
            
            # Add title
            fig.text(0.5, 0.98, f"Table: {table_name}", ha='center', va='top', 
                    fontsize=16, fontweight='bold', 
                    bbox=dict(boxstyle="round,pad=0.3", facecolor='lightgray', alpha=0.5))
            
            # Create table
            table = ax.table(
                cellText=df.values,
                colLabels=df.columns,
                cellLoc='left',
                loc='center',
                colWidths=[1.0/n_cols] * n_cols
            )
            
            # Style table
            table.auto_set_font_size(False)
            table.set_fontsize(10)
            table.scale(1.2, 1.8)
            
            # Color scheme
            header_color = '#2E86AB'
            row_colors = ['#F0F0F0', '#FFFFFF']
            
            # Style cells
            for i in range(n_rows):
                for j in range(n_cols):
                    cell = table[(i, j)]
                    
                    # First row as header
                    if i == 0:
                        cell.set_facecolor(header_color)
                        cell.set_text_props(weight='bold', color='white')
                        cell.set_height(0.08)
                    else:
                        # Alternate row colors
                        cell.set_facecolor(row_colors[i % 2])
                        cell.set_height(0.06)
                    
                    # Add padding
                    cell.set_text_props(linespacing=1.5)
            
            # Add border
            for key, cell in table.get_celld().items():
                cell.set_linewidth(1)
                cell.set_edgecolor('gray')
            
            # Adjust layout
            plt.subplots_adjust(left=0.02, right=0.98, top=0.92, bottom=0.02)
            
            # Save to bytes
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=200, bbox_inches='tight', 
                       pad_inches=0.5, facecolor='white', edgecolor='none')
            plt.close()
            
            buf.seek(0)
            return buf.read()
            
        except Exception as e:
            print(f"Error converting table to image with matplotlib: {e}")
            return None
    
    async def _extract_from_docx_enhanced(
        self, 
        docx_data: bytes, 
        project_id: int, 
        db: Session, 
        extract_tables: bool = True
    ) -> int:
        """Enhanced DOCX extraction with improved table handling"""
        extracted_count = 0
        
        try:
            import zipfile
            import tempfile
            from docx import Document
            
            # Get current image count for ordering
            from ..models.project import ProjectImage
            current_count = db.query(ProjectImage).filter(ProjectImage.project_id == project_id).count()
            
            # Save DOCX temporarily
            with tempfile.NamedTemporaryFile(suffix='.docx', delete=False) as tmp_file:
                tmp_file.write(docx_data)
                tmp_path = tmp_file.name
            
            try:
                # Extract images from DOCX
                with zipfile.ZipFile(tmp_path, 'r') as docx_zip:
                    for file_info in docx_zip.filelist:
                        if file_info.filename.startswith('word/media/') and not file_info.is_dir():
                            try:
                                image_data = docx_zip.read(file_info.filename)
                                
                                if len(image_data) < self.min_image_size:
                                    continue
                                
                                filename = f"figure_{Path(file_info.filename).name}"
                                
                                await self.db_image_service.save_image_bytes_to_db(
                                    image_bytes=image_data,
                                    filename=filename,
                                    project_id=project_id,
                                    db=db,
                                    order_index=current_count + extracted_count,
                                    is_featured=(current_count == 0 and extracted_count == 0)
                                )
                                
                                extracted_count += 1
                                
                            except Exception as e:
                                print(f"Failed to extract image {file_info.filename}: {e}")
                                continue
                
                # Extract tables from DOCX if requested
                if extract_tables:
                    doc = Document(tmp_path)
                    table_count = 0
                    
                    for table_idx, table in enumerate(doc.tables):
                        try:
                            # Convert table to pandas DataFrame
                            data = []
                            for row in table.rows:
                                row_data = []
                                for cell in row.cells:
                                    cell_text = cell.text.strip()
                                    row_data.append(cell_text)
                                data.append(row_data)
                            
                            if len(data) >= self.min_table_rows:
                                # Ensure all rows have same number of columns
                                max_cols = max(len(row) for row in data)
                                for row in data:
                                    while len(row) < max_cols:
                                        row.append('')
                                
                                df = pd.DataFrame(data)
                                
                                # Clean and validate table
                                df = self._clean_table(df)
                                
                                if self._is_valid_table_enhanced(df):
                                    saved = await self._save_table_as_image(
                                        df, project_id, db, current_count + extracted_count,
                                        f"docx_table_{table_count + 1}"
                                    )
                                    if saved:
                                        extracted_count += 1
                                        table_count += 1
                                
                        except Exception as e:
                            print(f"Failed to extract table {table_idx}: {e}")
                            continue
                
                print(f"Successfully extracted {extracted_count} images and tables from DOCX")
                
            finally:
                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)
            
        except Exception as e:
            print(f"Error extracting from DOCX: {e}")
            import traceback
            traceback.print_exc()
        
        return extracted_count
