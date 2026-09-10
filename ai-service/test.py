import os
from google.auth import default

print("GOOGLE_APPLICATION_CREDENTIALS:")
print(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))

creds, project = default()

print("\nProject:", project)
print("Service Account:", getattr(creds, "service_account_email", "Not a service account"))