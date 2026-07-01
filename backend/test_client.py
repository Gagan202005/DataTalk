from fastapi.testclient import TestClient
from app.main import app
import io

client = TestClient(app)

def test_upload():
    print("Sending request...")
    file_content = b"col1,col2\n1,2\n3,4"
    files = {'file': ('test.csv', file_content, 'text/csv')}
    response = client.post("/api/upload", files=files)
    print("Response Status Code:", response.status_code)
    print("Response JSON:", response.json())

if __name__ == "__main__":
    test_upload()
