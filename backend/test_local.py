import asyncio
import io
import pandas as pd
from fastapi import UploadFile

from app.core.file_handler import parse_upload
from app.core.database import DatabaseManager

async def main():
    print("Starting test...")
    csv_content = b"col1,col2\n1,2\n3,4"
    
    file = UploadFile(filename="test.csv", file=io.BytesIO(csv_content))
    df = await parse_upload(file)
    print("Parsed DataFrame:")
    print(df)
    
    print("Creating DB...")
    db = DatabaseManager("test_session")
    db.load_dataframe(df, table_name="data")
    print("DB created successfully. Row count:")
    print(db.get_row_count())

asyncio.run(main())
