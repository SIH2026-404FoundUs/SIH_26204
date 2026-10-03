// Shared helpers for the seed export/migrate CLI scripts.
import readline from "node:readline";

export function askConfirmation(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Mongo lean doc -> JSON-safe seed doc: stringify _id (or drop it), strip __v.
export function cleanDoc(doc, { keepId = true } = {}) {
  const clean = { ...doc };
  if (keepId && clean._id) {
    if (typeof clean._id === "object" && clean._id.toString) clean._id = clean._id.toString();
  } else if (!keepId) {
    delete clean._id;
  }
  delete clean.__v;
  return clean;
}
