import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { buildReportHtml } from "../templates/report.template";
import type { ProcessInputs, PartialAssessmentResult } from "@torch/core-shared";

const footerTemplate = `
<div style="
  width: 100%;
  padding: 0 18mm;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 7.5pt;
  color: #a3a3a3;
  letter-spacing: 0.04em;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 0.5px solid #e5e5e5;
  padding-top: 4mm;
">
  <span>torch.lemnisca.bio &nbsp;·&nbsp; MOSCH Scale-Up Risk Assessment</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;

const emptyHeader = `<div></div>`;

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
    await page.evaluateHandle("document.fonts.ready");

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: emptyHeader,
      footerTemplate,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
