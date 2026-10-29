"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";

const UPDATED = "2026-10-29";
const EMAIL = "cyjung@gmail.com";

function Shell({ title, children }: { title: string; children: ReactNode }) {
  const { tr } = useLocale();
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-12">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--accent)]">← FPL Live</Link>
        <LocaleToggle />
      </div>
      <h1 className="mt-6 text-3xl font-semibold leading-tight">{title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {tr(`시행일·최종 갱신: ${UPDATED} (초안 — 법률 검토 전)`, `Effective / last updated: ${UPDATED} (draft, not yet legally reviewed)`)}
      </p>
      <div className="mt-6 space-y-6 break-keep text-[15px] leading-7 [&_a]:font-semibold [&_a]:text-[var(--accent)] [&_a]:underline [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:w-full [&_td]:border [&_td]:border-[var(--border)] [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:border-[var(--border)] [&_th]:bg-[var(--surface)] [&_th]:p-2 [&_th]:text-left">
        {children}
      </div>
    </main>
  );
}

export function PrivacyContent() {
  const { tr } = useLocale();
  return (
    <Shell title={tr("개인정보처리방침", "Privacy Policy")}>
      <p>
        {tr(
          "FPL Live(이하 ‘서비스’)는 운영자 chanyong 이 운영하는 비공식 FPL 팬 서비스입니다. 회원가입·로그인이 없으며, 아래에 적은 것 외의 개인정보는 받지 않습니다.",
          "FPL Live (the “Service”) is an unofficial FPL fan service run by chanyong. There is no sign-up or login, and no personal data is collected beyond what is listed below."
        )}
      </p>
      <section>
        <h2>{tr("1. 처리하는 정보와 목적", "1. What we process and why")}</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>{tr("구분", "Category")}</th>
                <th>{tr("항목", "Data")}</th>
                <th>{tr("목적·보관", "Purpose / retention")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{tr("이용 통계 (Google Analytics 4)", "Usage statistics (Google Analytics 4)")}</td>
                <td>{tr("방문 페이지, 유입 경로, 기기·브라우저 정보, 대략적 지역, 쿠키 식별값(_ga, _ga_*)", "Pages viewed, referrer, device/browser, approximate region, cookie IDs (_ga, _ga_*)")}</td>
                <td>{tr("서비스 개선. Google Analytics 보관 설정(최대 14개월)에 따름", "Improving the Service. Kept per the GA retention setting (up to 14 months)")}</td>
              </tr>
              <tr>
                <td>{tr("‘의견·질문’ 버튼", "“Feedback” button")}</td>
                <td>{tr("유형, 내용, 답변 받을 연락처(선택), 보낸 페이지 주소, 반복 전송 방지용 IP 해시(원문 미저장)", "Type, message, optional contact, page URL, a hashed IP to stop repeat spam (raw IP not stored)")}</td>
                <td>{tr("문의 답변·오류 수정. 운영자의 딸깍랭크(ddalkkakrank.kr) 의견함에 저장, 받은 날로부터 1년 뒤 자동 삭제", "Replying and fixing bugs. Stored in the operator's DdalkkakRank (ddalkkakrank.kr) inbox, deleted automatically after 1 year")}</td>
              </tr>
              <tr>
                <td>{tr("접속 기록", "Server logs")}</td>
                <td>{tr("요청 주소, 시각, 오류 내용 (호스팅 업체 Railway 가 기록)", "Request path, time, errors (recorded by the host, Railway)")}</td>
                <td>{tr("장애 대응·보안. 호스팅 업체 보관 정책에 따름", "Operations and security, per the host's retention")}</td>
              </tr>
              <tr>
                <td>{tr("브라우저 저장소 (서버로 보내지 않음)", "Browser storage (never sent to us)")}</td>
                <td>{tr("언어 설정, 최근 본 리그 목록, 리그별 ‘나·라이벌’ 선택", "Language, recent leagues list, per-league “me / rival” choice")}</td>
                <td>{tr("편의 기능. 브라우저에서 사이트 데이터를 지우면 삭제", "Convenience. Removed when you clear site data")}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2">
          {tr(
            "화면에 보이는 매니저 이름·팀 이름·점수는 FPL이 공개한 리그 정보를 그때그때 불러와 보여 주는 것이며, 서비스가 따로 저장하지 않습니다(최대 30분의 메모리 캐시만 사용).",
            "Manager names, team names and scores are FPL's public league data fetched on demand; the Service does not store them (only an in-memory cache of up to 30 minutes)."
          )}
        </p>
      </section>
      <section>
        <h2>{tr("2. 쿠키와 거부 방법", "2. Cookies and how to opt out")}</h2>
        <p>
          {tr(
            "서비스 자체는 쿠키를 만들지 않습니다. Google Analytics 가 이용 통계용 쿠키(_ga, _ga_*, 최대 2년)를 씁니다. 광고 목적의 쿠키는 쓰지 않습니다. 거부하려면 브라우저 설정에서 쿠키를 차단하거나 ",
            "The Service sets no cookies itself. Google Analytics uses statistics cookies (_ga, _ga_*, up to 2 years). No advertising cookies are used. To opt out, block cookies in your browser or install the "
          )}
          <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noreferrer">
            {tr("Google 애널리틱스 차단 부가기능", "Google Analytics Opt-out Add-on")}
          </a>
          {tr("을 설치하세요. 거부해도 모든 기능을 그대로 쓸 수 있습니다.", ". Everything keeps working if you opt out.")}
        </p>
      </section>
      <section>
        <h2>{tr("3. 처리 위탁·국외 이전", "3. Processors and overseas transfer")}</h2>
        <ul>
          <li>{tr("Railway (미국) — 웹 호스팅", "Railway (USA) — web hosting")}</li>
          <li>{tr("Google (미국) — 이용 통계(Google Analytics)", "Google (USA) — usage statistics (Google Analytics)")}</li>
          <li>{tr("딸깍랭크 서버(운영자 운영) — ‘의견·질문’ 접수", "DdalkkakRank server (same operator) — feedback inbox")}</li>
        </ul>
        <p>{tr("개인정보를 제3자에게 판매하거나 제공하지 않습니다.", "We never sell or share personal data with third parties.")}</p>
      </section>
      <section>
        <h2>{tr("4. 이용자의 권리", "4. Your rights")}</h2>
        <p>
          {tr(
            `보낸 의견의 열람·삭제를 원하면 ‘의견·질문’ 버튼이나 ${EMAIL} 로 요청해 주세요. 브라우저 저장소의 정보는 브라우저에서 직접 지울 수 있습니다.`,
            `To see or delete feedback you sent, ask via the Feedback button or ${EMAIL}. Browser-stored data can be cleared in your browser.`
          )}
        </p>
      </section>
      <section>
        <h2>{tr("5. 만 14세 미만", "5. Children")}</h2>
        <p>{tr("회원가입이 없으며 만 14세 미만 아동의 개인정보를 알고 수집하지 않습니다.", "There is no sign-up and we do not knowingly collect data from children under 14.")}</p>
      </section>
      <section>
        <h2>{tr("6. 책임자·문의", "6. Contact")}</h2>
        <p>{tr(`운영자·개인정보 보호책임자: chanyong / ${EMAIL} / 화면 아래 ‘의견·질문’ 버튼`, `Operator and privacy contact: chanyong / ${EMAIL} / the Feedback button at the bottom of each page`)}</p>
        <p>{tr("방침이 바뀌면 이 페이지에 갱신일과 함께 알립니다.", "Changes are posted on this page with a new date.")}</p>
      </section>
    </Shell>
  );
}

export function TermsContent() {
  const { tr } = useLocale();
  return (
    <Shell title={tr("이용약관", "Terms of Use")}>
      <section>
        <h2>{tr("1. 서비스", "1. The Service")}</h2>
        <p>
          {tr(
            "FPL Live 는 운영자 chanyong 이 무료로 제공하는 비공식 팬 서비스로, Fantasy Premier League 가 공개한 데이터로 미니리그 순위·잠정 점수·보너스 예상·가격 변동 예측을 보여 줍니다. Premier League 및 Fantasy Premier League 와 제휴 관계가 없습니다.",
            "FPL Live is a free, unofficial fan service run by chanyong that shows mini-league standings, provisional points, bonus projections and price change predictions from Fantasy Premier League's public data. It is not affiliated with the Premier League or Fantasy Premier League."
          )}
        </p>
      </section>
      <section>
        <h2>{tr("2. 정보의 정확성", "2. Accuracy")}</h2>
        <p>
          {tr(
            "잠정 점수·자동 교체·보너스 예상·가격 변동 예측은 추정치이며 FPL 공식 확정값과 다를 수 있습니다. 이적·주장 결정 등은 이용자 본인의 판단과 책임으로 하며, 서비스 정보로 생긴 손해에 대해 운영자는 고의·중과실이 없는 한 책임지지 않습니다.",
            "Provisional points, auto-subs, bonus projections and price predictions are estimates and can differ from FPL's final figures. Transfer and captaincy decisions are your own; the operator is not liable for losses arising from the information except in cases of intent or gross negligence."
          )}
        </p>
      </section>
      <section>
        <h2>{tr("3. 이용 시 지켜 주실 것", "3. Acceptable use")}</h2>
        <ul>
          <li>{tr("자동화 도구로 과도하게 요청해 서비스나 FPL 서버에 부담을 주지 마세요.", "Do not send excessive automated requests that burden the Service or FPL's servers.")}</li>
          <li>{tr("서비스를 FPL 공식 서비스로 오인하게 하거나 금전을 요구하는 데 쓰지 마세요.", "Do not present the Service as official FPL or use it to ask anyone for money.")}</li>
        </ul>
      </section>
      <section>
        <h2>{tr("4. 서비스 변경·중단", "4. Changes and interruptions")}</h2>
        <p>
          {tr(
            "FPL 데이터 제공 방식이 바뀌거나 점검·장애가 있으면 기능이 바뀌거나 잠시 멈출 수 있습니다. 서비스는 사전 예고 없이 변경·종료될 수 있습니다.",
            "Features may change or pause if FPL changes its data or during maintenance or outages. The Service may change or end without notice."
          )}
        </p>
      </section>
      <section>
        <h2>{tr("5. 권리", "5. Rights")}</h2>
        <p>
          {tr(
            "선수·구단 이름과 이미지, FPL 데이터의 권리는 각 권리자에게 있습니다. 개인정보 처리는 ",
            "Player and club names, images and FPL data belong to their respective owners. Personal data is handled under the "
          )}
          <Link href="/privacy">{tr("개인정보처리방침", "Privacy Policy")}</Link>
          {tr("을 따릅니다.", ".")}
        </p>
      </section>
      <section>
        <h2>{tr("6. 문의", "6. Contact")}</h2>
        <p>{tr(`chanyong / ${EMAIL} / 화면 아래 ‘의견·질문’ 버튼`, `chanyong / ${EMAIL} / the Feedback button`)}</p>
      </section>
    </Shell>
  );
}
