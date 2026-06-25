import { test, expect } from "../fixtures";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("debug - see what page renders", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(3000);
  const html = await page.content();
  const outputPath = path.join(__dirname, "..", "test-output", "page-html.txt");
  fs.writeFileSync(outputPath, html);
  console.log("Wrote HTML to", outputPath);
});
