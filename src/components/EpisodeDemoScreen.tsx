import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useEpisodeGenerationController } from "../hooks/useEpisodeGenerationController";

/*
 * 현재 App.tsx에는 연결하지 않은 내부 검증용 화면이다.
 * STT 원문 -> Gemini 에피소드 생성 -> 로컬 저장 파이프라인 점검 시에만 임시 연결한다.
 */
const SAMPLE_STT = `음... 그때가 언제였더라. 아마 막내 태어나고 얼마 안 됐을 때였을 거다. 엄마가 마흔 조금 넘었을 때니까... 창원으로 이사 갔던 시기랑 비슷했을 거야. 근데 사실 창원 아파트 들어간 것도 형편이 좋아서 간 건 아니었거든. 원래는 남편이 알고 지내던 사장님 회사에서 일했었는데, 그 회사 옥탑방에 남는 방이 하나 있어서 거기서 우리 여섯 식구가 살았지. 그때는 그래도 잘 곳은 있었는데 회사 사정이 점점 안 좋아지더라. 일거리도 줄고 월급도 제대로 못 받는 날이 생기고 말이야. 그래서 결국은 거기서 나와야 됐는데, 모아놓은 돈도 없고 당장 식구들 데리고 갈 데도 없고 참 막막하더라. 그래도 우짜겠노. 은행 대출 받아가 겨우 창원에 아파트 하나 들어갔지. 지금 생각하면 참 겁도 없었다. 대출은 받았는데 생활비는 없고, 세 아이랑 시부모님까지 모시고 살아야 했으니까. 그래도 먹고는 살아야 하니까 뭐라도 해야 되겠다 싶더라. 아 맞다. 그때 포터 한 대 있었잖아. 그걸로 장사 시작한 거지. 참외 떼다가 팔고 그랬다 아이가. 새벽같이 나가서 장사하고 늦게 들어오고. 장사가 잘되면 모르겠는데 안 되는 날도 많았어. 그래도 애들 생각하면 쉬지도 못하겠더라. 집에서 엄마 아빠 기다리고 있을 거 생각하면 뭐라도 벌어야 되니까. 먹는 것도 줄이고 사고 싶은 것도 참고 그랬지. 그러고 보니까 김밥 이야기 있었네. 엄마는 그게 아직도 기억난다. 남편이랑 둘이 장사 나가 있었는데 아침도 못 먹고 나왔거든. 점심쯤 됐는데 배가 너무 고픈 거야. 뭐라도 먹어야겠다 싶어서 돈을 세어보니까 천오백 원밖에 없더라. 그 돈 가지고 뭘 먹겠노. 그래가 김밥 한 줄 사 왔지. 근데 남편이 자기는 안 먹어도 된다면서 나보고 다 먹으라 하더라. 말은 그렇게 하는데 아침부터 아무것도 안 먹었으니까 배고픈 건 똑같았을 거 아이가. 그래서 내가 됐다, 반 갈라서 같이 먹자 하고 나눠줬지. 둘이 나눠 먹고 있었는데 자기는 다 먹었다고 하면서 몇 조각 남은 것도 내 쪽으로 밀어주더라. 그 사람 성격이 원래 좀 그렇다. 자기 배고픈 건 참고 가족 먼저 챙기고. 힘든 소리도 잘 안 하고. 누가 들으면 김밥 몇 조각 가지고 뭘 그러노 하겠지만 엄마는 이상하게 그 장면이 아직도 생각난다. 돈이 없어서 김밥 한 줄 나눠 먹던 시절이었는데, 그때 서로 챙겨주던 마음이 있었으니까 지금까지 이렇게 살아온 것도 있는 것 같고. 그때는 하루하루 버티는 게 참 힘들거든. 근데 지나고 보니까 제일 기억나는 건 돈이 아니라 그 김밥 몇 조각더라. 참 신기하더라. 힘들었던 일은 많이 잊어버렸는데, 그날 남편이 나 챙겨주던 그 마음은 아직도 기억에 남아 있으니까.`;

const panel = {
  backgroundColor: "#ffffff",
  padding: "20px",
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
};

export function EpisodeDemoScreen() {
  const { episodes, isLoading, error, generateAutobiography } =
    useEpisodeGenerationController();
  const [inputText, setInputText] = useState(SAMPLE_STT);
  const latest = episodes[0];
  const storageName = Capacitor.isNativePlatform() ? "SQLite" : "localStorage fallback";

  return (
    <main style={{ padding: "24px", background: "#f8fafc", minHeight: "100vh" }}>
      <section style={{ ...panel, marginBottom: "24px" }}>
        <h2 style={{ margin: "0 0 8px", color: "#1e293b" }}>
          STT 기반 에피소드 파이프라인 검증 시스템
        </h2>
        <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
          약 2,500자 STT 입력 → 약 500자 자서전 생성 → 목표 압축률 80% → {storageName} 저장
        </p>
      </section>

      <section style={{ ...panel, marginBottom: "24px" }}>
        <h3 style={{ marginTop: 0, fontSize: "15px" }}>부모님 인터뷰 STT 원문</h3>
        <textarea
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
          style={{ width: "100%", minHeight: "160px", padding: "12px", boxSizing: "border-box" }}
        />
        <button
          type="button"
          onClick={() => void generateAutobiography(inputText)}
          disabled={isLoading}
          style={{ width: "100%", padding: "14px", marginTop: "12px", fontWeight: 700 }}
        >
          {isLoading ? "Gemini 분석 및 로컬 저장 진행 중..." : "자서전 생성 및 로컬 DB 저장"}
        </button>
        {error && <p style={{ color: "#dc2626" }}>예외 처리: {error}</p>}
      </section>

      {latest && (
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <article style={panel}>
              <h3>[A] STT 적재 원문</h3>
              <p style={{ maxHeight: "220px", overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                {latest.stt_raw}
              </p>
            </article>
            <article style={panel}>
              <h3>{storageName} 데이터 무결성 스탬프</h3>
              <p><strong>ID:</strong> {latest.episode_id}</p>
              <p><strong>저장 시각:</strong> {latest.created_at}</p>
              <p><strong>태그:</strong> {latest.tags.join(", ")}</p>
              <p><strong>모델:</strong> {latest.llm_model}</p>
              <p>
                <strong>압축:</strong> {latest.stt_length}자 → {latest.summary_length}자
                {" "}({latest.compression_rate}%)
              </p>
            </article>
          </div>

          <article style={{ ...panel, padding: "32px" }}>
            <small style={{ color: "#0d9488", fontWeight: 700 }}>[B] 최종 자서전 리더 출력</small>
            <h1>{latest.title}</h1>
            <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.9 }}>{latest.content}</p>
          </article>
        </section>
      )}
    </main>
  );
}
