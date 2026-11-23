"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LocaleToggle, useLocale } from "@/components/locale-provider";
import { SiteHeader } from "@/components/site-header";
import { CONTACT_EMAIL } from "@/lib/site";

// Each page carries its own date. Both changed on 2026-11-03 when the contact address moved (#12);
// the privacy page also lists the GA4 feature-use events added the same day (#19).
// 2026-11-22: the privacy page gained the personal squad screen /team (#39).
const PRIVACY_UPDATED = "2026-11-22";
const TERMS_UPDATED = "2026-11-08";
const EMAIL = CONTACT_EMAIL;

function Shell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const { tr } = useLocale();
  return (
    <main className="page-shell [&>*]:max-w-3xl">
      <SiteHeader>
        <LocaleToggle />
      </SiteHeader>
      <h1 className="mt-6 text-3xl font-semibold leading-tight">{title}</h1>
      <p className="mt-2 text-body text-[var(--muted)]">
        {tr(`시행일·최종 갱신: ${updated} (초안 — 법률 검토 전)`, `Effective / last updated: ${updated} (draft, not yet legally reviewed)`)}
      </p>
      <div className="mt-6 space-y-6 break-keep text-body-lg leading-7 [&_a]:font-semibold [&_a]:text-[var(--accent)] [&_a]:underline [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:w-full [&_td]:border [&_td]:border-[var(--border)] [&_td]:p-2 [&_td]:align-top [&_th]:border [&_th]:border-[var(--border)] [&_th]:bg-[var(--surface)] [&_th]:p-2 [&_th]:text-left">
        {children}
      </div>
    </main>
  );
}

export function PrivacyContent() {
  const { tr } = useLocale();
  return (
    <Shell title={tr("개인정보처리방침", "Privacy Policy")} updated={PRIVACY_UPDATED}>
      <p>
        {tr(
          "FPL Live(이하 ‘서비스’)는 운영자 chanyong 이 운영하는 비공식 FPL 팬 서비스입니다. 대시보드는 가입 없이 쓸 수 있고, 선택 기능인 ‘주간 경기 리뷰 일지’를 쓸 때만 회원가입(이메일)을 합니다. 아래에 적은 것 외의 개인정보는 받지 않습니다.",
          "FPL Live (the “Service”) is an unofficial FPL fan service run by chanyong. The dashboard works without an account; sign-up (email) is needed only for the optional “Weekly review journal”. No personal data is collected beyond what is listed below."
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
                <td>
                  {tr("방문 페이지, 유입 경로, 기기·브라우저 정보, 대략적 지역, 쿠키 식별값(_ga, _ga_*)", "Pages viewed, referrer, device/browser, approximate region, cookie IDs (_ga, _ga_*)")}
                  <br />
                  {tr(
                    "기능 이용 기록: 검색 실행(검색어는 리그 ID·선수·구단 이름만, 리그 순위표의 매니저·팀 이름 검색은 횟수만), 외부 사이트 링크 클릭(이동한 주소), ‘의견·질문’ 버튼 열기",
                    "Feature use: searches (search text only for league IDs and player/club names; manager/team-name searches in league tables are counted without the text), clicks on links to other sites (the destination address), opening the Feedback button"
                  )}
                </td>
                <td>{tr("서비스 개선. Google Analytics 보관 설정(최대 14개월)에 따름", "Improving the Service. Kept per the GA retention setting (up to 14 months)")}</td>
              </tr>
              <tr>
                <td>{tr("‘의견·질문’ 버튼", "“Feedback” button")}</td>
                <td>{tr("유형, 내용, 답변 받을 연락처(선택), 보낸 페이지 주소, 반복 전송 방지용 IP 해시(원문 미저장)", "Type, message, optional contact, page URL, a hashed IP to stop repeat spam (raw IP not stored)")}</td>
                <td>{tr("문의 답변·오류 수정. 운영자의 딸깍랭크(ddalkkakrank.kr) 의견함에 저장, 받은 날로부터 1년 뒤 자동 삭제", "Replying and fixing bugs. Stored in the operator's DdalkkakRank (ddalkkakrank.kr) inbox, deleted automatically after 1 year")}</td>
              </tr>
              <tr>
                <td>{tr("주간 경기 리뷰 일지 (회원가입 시)", "Weekly review journal (members only)")}</td>
                <td>
                  {tr(
                    "이메일, 비밀번호(암호화 저장은 인증 서비스가 처리), 등록한 FPL 팀 번호와 그 팀을 바꾼 시각, 게임위크별 자동 저장 기록(점수·순위·선발·벤치·주장·이적·경기 결과), 직접 적은 일지 내용. FPL 비밀번호는 받지 않습니다.",
                    "Email, password (stored hashed by the auth provider), the FPL team ID you registered and the time you last changed it, per-gameweek saved records (points, rank, squad, bench, captain, transfers, results) and the notes you write. We never ask for your FPL password."
                  )}
                </td>
                <td>
                  {tr(
                    "일지 제공·로그인. 등록한 팀 번호는 본인 팀의 선발·캡틴·이적 분석을 보여 주는 데 쓰고(다른 팀의 분석은 보여 주지 않습니다), 팀을 바꾼 시각은 잦은 변경을 막는 30일 제한에 씁니다. 팀을 바꾸면 이전 팀의 자동 저장 기록은 삭제되고 직접 적은 메모는 남습니다. 본인만 열람할 수 있고, 탈퇴 요청 시 지체 없이 삭제합니다. 저장·인증은 수탁자 Supabase Inc.가 운영하는 서울 리전 서버에서 처리하고, 확인 메일 발송을 위해 이메일 주소가 Resend에 전달됩니다. 로그인 상태 유지를 위한 쿠키 1개를 씁니다.",
                    "Providing the journal and login. The registered team ID is used to show the lineup, captain and transfer analysis for your own team (not for other teams), and the time of the last change is used for a 30-day limit on changes. When you change teams, the previous team's automatically saved records are deleted and the notes you wrote are kept. Only you can read it; deleted promptly on request. Storage and authentication are processed by our processor, Supabase Inc., on servers in the Seoul region; your email address is passed to Resend to send confirmation emails. One login cookie is used."
                  )}
                </td>
              </tr>
              <tr>
                <td>{tr("내 스쿼드 보기 (/team, 가입 없이 스쿼드 화면)", "My squad screen (/team, the squad view needs no account)")}</td>
                <td>
                  {tr(
                    "이용자가 입력하거나 리그 순위표에서 연 FPL 팀 번호(화면 주소에 포함). 그 번호로 FPL 이 공개한 팀 이름·매니저 이름·선수단·이적·칩 사용 기록을 불러와 보여 줍니다. 다른 사람의 팀 번호로도 볼 수 있는 공개 정보이며, FPL 로그인·비밀번호는 받지 않습니다. 선발·캡틴·이적 분석은 이 화면에 나오지만 그 팀을 등록한 회원에게만 보입니다(회원 항목 참고).",
                    "The FPL team ID you type or open from a league table (part of the page address). With it the Service loads the team name, manager name, squad, transfers and chip history that FPL publishes and shows them. It is public information anyone can look up by team ID; no FPL login or password is taken. The lineup, captain and transfer analysis also appears on this screen but only to the member who registered that team (see the members row)."
                  )}
                </td>
                <td>
                  {tr(
                    "개인 팀 화면 제공. 서버는 저장하지 않고 최대 5분 메모리 캐시만 씁니다. 요청 횟수 제한(팀 번호를 차례로 조회하는 것 방지)을 위해 IP 주소를 메모리에서만 세고 약 10분 뒤 지우며, 디스크에는 저장하지 않습니다. 개인 팀 화면은 검색엔진에 노출하지 않도록 설정했습니다(noindex, 사이트맵 제외).",
                    "Showing the team screen. Not stored by the server, only an in-memory cache of up to 5 minutes. IP addresses are counted in memory only, to limit request rates (to stop walking through team IDs), dropped after about 10 minutes and never written to disk. Team screens are kept out of search engines (noindex, not in the sitemap)."
                  )}
                </td>
              </tr>
              <tr>
                <td>{tr("접속 기록", "Server logs")}</td>
                <td>{tr("요청 주소, 시각, 오류 내용 (호스팅 업체 Railway 가 기록)", "Request path, time, errors (recorded by the host, Railway)")}</td>
                <td>{tr("장애 대응·보안. 호스팅 업체 보관 정책에 따름", "Operations and security, per the host's retention")}</td>
              </tr>
              <tr>
                <td>{tr("브라우저 저장소 (서버로 보내지 않음)", "Browser storage (never sent to us)")}</td>
                <td>{tr("언어 설정, 최근 본 리그 목록, ‘내 팀’으로 기억한 FPL 팀 번호와 팀 이름, 스쿼드 보기 방식(피치·리스트)", "Language, recent leagues list, the FPL team ID and team name you chose to remember as “my team”, squad view choice (pitch or list)")}</td>
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
            "서비스는 일지에 로그인했을 때만 로그인 유지용 쿠키 1개를 만듭니다(최대 1시간). Google Analytics 가 이용 통계용 쿠키(_ga, _ga_*, 최대 2년)를 씁니다. 광고 목적의 쿠키는 쓰지 않습니다. 거부하려면 브라우저 설정에서 쿠키를 차단하거나 ",
            "The Service sets one login cookie only when you log in to the journal (up to 1 hour). Google Analytics uses statistics cookies (_ga, _ga_*, up to 2 years). No advertising cookies are used. To opt out, block cookies in your browser or install the "
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
          <li>{tr("Supabase Inc. (서울 리전, ap-northeast-2) — 회원 인증·일지 저장", "Supabase Inc. (Seoul region, ap-northeast-2) — member authentication and journal storage")}</li>
          <li>{tr("Resend — 가입 확인 메일 발송(이메일 주소를 전달)", "Resend — sends sign-up confirmation emails (receives your email address)")}</li>
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
        <p>{tr("만 14세 미만 아동은 회원가입을 할 수 없으며, 그 개인정보를 알고 수집하지 않습니다.", "Children under 14 may not sign up and we do not knowingly collect their data.")}</p>
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
    <Shell title={tr("이용약관", "Terms of Use")} updated={TERMS_UPDATED}>
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
        <h2>{tr("6. 회원(주간 경기 리뷰 일지)", "6. Members (weekly review journal)")}</h2>
        <ul>
          <li>{tr("가입은 이메일과 FPL 팀 번호로 하며, FPL 비밀번호는 받지 않습니다. 팀 번호당 계정은 하나입니다. 가입 때 팀 번호를 조회해 팀 이름과 매니저 이름을 확인합니다.", "Sign-up uses an email and an FPL team ID; we never ask for your FPL password. One account per team ID. At sign-up you look the team ID up and confirm the team name and manager.")}</li>
          <li>{tr("등록한 팀 번호는 본인 팀의 선발·캡틴·이적 분석을 제공하는 데 쓰입니다. 이 분석은 등록한 본인 팀에만 제공하며, 다른 팀 번호로는 볼 수 없습니다. 이용자는 등록한 팀을 바꿀 수 있으나, 바꾸면 이전 팀의 자동 저장 기록이 삭제되고(직접 쓴 메모는 남음) 바꾼 뒤 30일 동안은 다시 바꿀 수 없습니다.", "The registered team ID is used to provide the lineup, captain and transfer analysis for your own team. The analysis is available only for the team you registered, not for other team IDs. You may change the registered team, but doing so deletes the previous team's automatically saved records (your own notes are kept) and you cannot change it again for 30 days.")}</li>
          <li>{tr("본인이 아닌 팀 번호로 가입하거나 타인의 계정에 접근하지 마세요. 팀 번호를 도용당했다면 문의처로 알려 주세요.", "Do not sign up with a team ID that is not yours or access others' accounts. If your team ID was taken, contact us.")}</li>
          <li>{tr("자동 저장은 FPL 공개 데이터를 기준으로 하며 지연·누락될 수 있고, 일지 내용의 백업은 이용자 책임입니다. 탈퇴·삭제는 문의처로 요청하세요.", "Auto-saving relies on FPL's public data and may be delayed or missed; keeping a backup of your notes is your responsibility. Ask via the contact below to delete your account.")}</li>
        </ul>
      </section>
      <section>
        <h2>{tr("7. 문의", "7. Contact")}</h2>
        <p>{tr(`chanyong / ${EMAIL} / 화면 아래 ‘의견·질문’ 버튼`, `chanyong / ${EMAIL} / the Feedback button`)}</p>
      </section>
    </Shell>
  );
}
