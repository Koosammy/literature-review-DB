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

# UHAS schools (source: uhas.edu.gh "University Structure" / "Who We Are").
# Kept as INSTITUTIONS for backward compatibility with existing code/API
# routes; the UI now labels this "School".
INSTITUTIONS = [
    "UHAS - Fred N. Binka School of Public Health",
    "UHAS - School of Allied Health Sciences",
    "UHAS - School of Basic and Biomedical Sciences",
    "UHAS - School of Medicine",
    "UHAS - School of Nursing and Midwifery",
    "UHAS - School of Pharmacy",
    "UHAS - School of Sports and Exercise Medicine",
    "UHAS - School of Graduate Studies",
]

# Alias so new code can refer to this by its real name.
SCHOOLS = INSTITUTIONS
