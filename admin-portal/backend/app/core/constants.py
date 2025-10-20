RESEARCH_AREAS = [
    "Medicine and Health Sciences",
    "Nursing and Midwifery", 
    "Public Health",
    "Pharmacy and Pharmaceutical Sciences",
    "Biomedical Sciences",
    "Clinical Psychology",
    "Epidemiology",
    "Health Policy and Management",
    "Nutrition and Dietetics",
    "Environmental Health",
    "Occupational Health and Safety",
    "Traditional and Alternative Medicine",
    "Medical Laboratory Sciences",
    "Physiotherapy and Rehabilitation",
    "Dentistry and Oral Health",
    "Health Information Management",
    "Physician Assistantship",
    "Optometry and Vision Science",
    "Sports and Exercise Medicine",
    "Others"  # This allows custom input
]

DEGREE_TYPES = [
    "PhD",
    "MPhil", 
    "MSc",
    "MA",
    "MPH",
    "MBA",
    "MD",
    "MBChB",
    "BPharm",
    "BSc",
    "BA",
    "Diploma",
    "Certificate",
    "Others"
]

# Generate academic years (last 10 years)
import datetime
current_year = datetime.datetime.now().year
ACADEMIC_YEARS = [f"{year}/{year+1}" for year in range(current_year, current_year-10, -1)]

# UHAS specific institutions/campuses
INSTITUTIONS = [
    "UHAS - FRED N. BINKA School of Public Health",
]
