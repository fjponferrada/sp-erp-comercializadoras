import zipfile
import xml.etree.ElementTree as ET
import re

docx_path = r"Z:\AED\Switching\CNMC - E - V3.0 2024.05.16\CNMC - E - Anexos 2024.05.16\CNMC - E - Tablas de Codigos  2024.05.16\CNMC - E - Tablas de códigos 2024.05.16.docx"

try:
    with zipfile.ZipFile(docx_path) as z:
        xml_content = z.read("word/document.xml")
        # Remove all xml tags
        text = re.sub(rb'<[^>]+>', b' ', xml_content).decode('utf-8')
        
        # Look for 018 and 019
        print("Looking for 2.0TD:")
        matches = re.finditer(r'.{0,40}2\.0.{0,40}', text)
        for m in matches:
            print("...", m.group(0).encode('ascii', 'ignore').decode('ascii'), "...")
            
        print("\nLooking for 3.0TD:")
        matches = re.finditer(r'.{0,40}3\.0.{0,40}', text)
        for m in matches:
            print("...", m.group(0).encode('ascii', 'ignore').decode('ascii'), "...")

except Exception as e:
    print(f"Error: {e}")
