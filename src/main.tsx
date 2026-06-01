import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/app.css";
// 임시 비활성: 현재 앱은 BiographyReaderScreen의 인라인 스타일을 사용한다.
// 구형 분리 리더를 복구할 때 함께 활성화한다.
// import "./styles/reader.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
