import os
import io
from app.utils.pdf_generator import generate_pdf_report

def main():
    messages = [
        {
            "role": "user",
            "content": "Show me total sales by region as a bar chart.",
        },
        {
            "role": "assistant",
            "content": "Here is the total sales by region.",
            "sql_query": "SELECT Region, SUM(Sales) as TotSales FROM test_sales GROUP BY Region;",
            "chart": {
                "type": "bar",
                "x_key": "Region",
                "y_key": "TotSales",
                "title": "Total Sales by Region",
                "data": [
                    {"Region": "North", "TotSales": 12000},
                    {"Region": "South", "TotSales": 9500},
                    {"Region": "East", "TotSales": 15000},
                    {"Region": "West", "TotSales": 18000},
                ]
            }
        },
        {
            "role": "user",
            "content": "Generate a scatter plot of age vs income, and a histogram of age.",
        },
        {
            "role": "assistant",
            "content": "Here are the plots you requested.",
            "python_code": "import matplotlib.pyplot as plt\nplt.scatter(df['age'], df['income'])\n...",
            # We don't have actual base64 images here without generating them, but let's test the JSON fallback first
        }
    ]

    tables = {
        "test_sales": {
            "schema": [{"name": "Region", "type": "VARCHAR"}, {"name": "Sales", "type": "DOUBLE"}],
            "dataQuality": {"overall_score": 95},
            "filename": "test_sales.csv",
            "rowCount": 100
        }
    }

    try:
        pdf_bytes = generate_pdf_report(
            messages=messages,
            tables=tables,
            template_info={"author": "Test Author"}
        )
        with open("test_output.pdf", "wb") as f:
            f.write(pdf_bytes)
        print("PDF generated successfully: test_output.pdf")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
