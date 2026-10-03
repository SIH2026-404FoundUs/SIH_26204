// Must be the first import of the server entry: ES modules evaluate imports in
// order, and modules such as lib/jwt.js and lib/mailer.js read process.env at
// import time. Loading .env later left them seeing NODE_ENV/BREVO_API_KEY unset.
// Explicit path, because dotenv's default is process.cwd() and finds nothing
// when the server is started from the repo root instead of backend/.
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../.env") });
