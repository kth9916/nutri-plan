import express from "express";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

/**
 * [자가 진단 4.1단계: ESM 호환 파일 스캐너]
 * 
 * __dirname 오류를 해결하고 서버 내부 파일 구조를 다시 확인합니다.
 */

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname_esm = path.dirname(__filename);

app.get("/api/health", (req, res) => {
  const getDirContents = (dirPath: string) => {
    try {
      const realPath = path.resolve(process.cwd(), dirPath);
      if (fs.existsSync(realPath)) {
        return fs.readdirSync(realPath).join(", ");
      }
      return "(존재하지 않음)";
    } catch (e: any) {
      return `(오류: ${e.message})`;
    }
  };

  const results = {
    "작업 디렉토리 (process.cwd)": process.cwd(),
    "현재 파일 위치 (__dirname_esm)": __dirname_esm,
    "루트 폴더 (.)": getDirContents("."),
    "api 폴더 (./api)": getDirContents("./api"),
    "server 폴더 (./server)": getDirContents("./server"),
    "server/_core 폴더 (./server/_core)": getDirContents("./server/_core"),
    "lib 폴더 (./lib)": getDirContents("./lib"),
  };

  let html = "<div style='font-family: monospace; padding: 20px;'>";
  html += "<h1>Vercel 서버 파일 시스템 스캔 (수정됨)</h1><ul>";
  for (const [key, value] of Object.entries(results)) {
    html += `<li><strong>${key}:</strong> ${value}</li>`;
  }
  html += "</ul>";
  html += "<p>에러가 나지 않고 이 화면이 보인다면, 이제 진짜 경로로 파일을 불러올 준비가 된 것입니다.</p></div>";

  res.status(200).send(html);
});

export default app;
