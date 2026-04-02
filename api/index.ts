import express from "express";
import * as fs from "fs";
import * as path from "path";

/**
 * [자가 진단 4단계: 파일 시스템 실사]
 * 
 * Vercel 서버 내부의 실제 파일 구조를 탐색하여 경로 문제를 100% 규명합니다.
 */

const app = express();

app.get("/api/health", (req, res) => {
  const getDirContents = (dirPath: string) => {
    try {
      const realPath = path.resolve(dirPath);
      if (fs.existsSync(realPath)) {
        return fs.readdirSync(realPath).join(", ");
      }
      return "존재하지 않음";
    } catch (e: any) {
      return `오류: ${e.message}`;
    }
  };

  const results = {
    "현재 디렉토리 (.)": getDirContents("."),
    "상위 디렉토리 (..)": getDirContents(".."),
    "api 디렉토리 (./api)": getDirContents("./api"),
    "server 디렉토리 (./server)": getDirContents("./server"),
    "server/_core 디렉토리 (./server/_core)": getDirContents("./server/_core"),
    "lib 디렉토리 (./lib)": getDirContents("./lib"),
    "현재 폴더 절대경로 (__dirname)": __dirname,
    "작업 디렉토리 (process.cwd)": process.cwd(),
  };

  let html = "<h1>Vercel 서버 파일 시스템 스캔</h1><ul>";
  for (const [key, value] of Object.entries(results)) {
    html += `<li><strong>${key}:</strong> ${value}</li>`;
  }
  html += "</ul>";
  html += "<p>이 목록을 보고 정확한 임포트 경로를 확정하겠습니다.</p>";

  res.status(200).send(html);
});

export default app;
