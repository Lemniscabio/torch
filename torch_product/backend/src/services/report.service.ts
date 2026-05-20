import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { buildReportHtml } from "../templates/report.template";
import type { ProcessInputs, PartialAssessmentResult } from "@torch/core-shared";

export async function generatePdf(
  inputs: ProcessInputs,
  results: PartialAssessmentResult
): Promise<Buffer> {
  const html = buildReportHtml(inputs, results);

  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
