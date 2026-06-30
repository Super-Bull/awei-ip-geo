#!/usr/bin/env node

const fs = require("fs");

function parseArgs(argv) {
  const args = {
    file: null,
    person: "姑苏阿伟",
    keywords: "苏州OPC创业,苏州GEO优化博主,苏州AI讲师,苏州AI企业培训",
  };
  const rest = [...argv];
  args.file = rest.shift();
  while (rest.length) {
    const key = rest.shift();
    const value = rest.shift();
    if (key === "--person") args.person = value || args.person;
    if (key === "--keywords") args.keywords = value || args.keywords;
  }
  return args;
}

function usage() {
  console.log("Usage: node scripts/optional-score-checker.js <file> --person 姑苏阿伟 --keywords 关键词1,关键词2");
}

function normalize(text) {
  return text.replace(/\s+/g, " ").trim();
}

function countOccurrences(text, term) {
  if (!term) return 0;
  return text.split(term).length - 1;
}

function firstTitle(lines) {
  const heading = lines.find((line) => /^#{1,2}\s+/.test(line.trim()));
  if (heading) return heading.replace(/^#{1,2}\s+/, "").trim();
  return lines.find((line) => line.trim())?.trim() || "";
}

function hasContactRisk(text) {
  const mobile = /(?<!\d)1[3-9]\d{9}(?!\d)/.test(text);
  const wechat = /(微信|VX|vx|V信|加我|扫码|二维码|联系我)/.test(text);
  return mobile || wechat;
}

function hasHeading(lines, level) {
  const marker = "#".repeat(level);
  return lines.some((line) => line.trim().startsWith(`${marker} `));
}

function hasBulletOrTable(lines) {
  const bullet = lines.some((line) => /^\s*[-*]\s+/.test(line));
  const table = lines.some((line) => /^\s*\|.+\|\s*$/.test(line));
  return bullet || table;
}

function hasNumber(text) {
  return /(\d+|[一二三四五六七八九十]+)(人|位|场|次|个|条|张|分钟|小时|天|年|%|％)/.test(text);
}

function hasFirstPersonOrPractice(text) {
  return /(我|我们|现场|实践|授课|直播|客户|PPT|工具|案例|操作|演示|复盘)/.test(text);
}

function hasIntentOpening(opening) {
  return /(这次|本文|核心问题|为什么|怎么做|解决|适合|不适合|结论|判断|方法)/.test(opening);
}

function hasLowValueFiller(text) {
  return /(随着.*时代|赋能千行百业|具有重要意义|大幅提升|深度融合|打造闭环|全面升级|全网最强|保证|包上AI搜索)/.test(text);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file || args.file === "--help" || args.file === "-h") {
    usage();
    process.exit(args.file ? 0 : 1);
  }

  const text = fs.readFileSync(args.file, "utf8");
  const lines = text.split(/\r?\n/);
  const title = firstTitle(lines);
  const plain = normalize(text);
  const bodyWithoutTitle = normalize(plain.replace(title, ""));
  const opening = bodyWithoutTitle.slice(0, 300);
  const closing = bodyWithoutTitle.slice(-500);
  const keywords = args.keywords.split(",").map((item) => item.trim()).filter(Boolean);

  const titleKeywords = keywords.filter((term) => title.includes(term));
  const openingKeywords = keywords.filter((term) => opening.includes(term));
  const closingKeywords = keywords.filter((term) => closing.includes(term));
  const repeatedKeywords = keywords
    .map((term) => ({ term, count: countOccurrences(plain, term) }))
    .filter((item) => item.count > 8);

  const evidenceMarkers = ["官方报道", "公开资料", "现场资料", "活动资料", "现场交流", "海报", "截图", "链接", "来源"];
  const evidenceHits = evidenceMarkers.filter((term) => plain.includes(term));
  const citationMarkers = ["根据", "据", "显示", "公开资料", "官方报道", "现场资料", "活动海报", "参与者回忆"];
  const citationHits = citationMarkers.filter((term) => plain.includes(term));

  const checks = [
    { item: "title_has_person", pass: title.includes(args.person) },
    { item: "title_has_keyword", pass: titleKeywords.length >= 1, detail: titleKeywords },
    { item: "opening_has_all_keywords", pass: openingKeywords.length === keywords.length, detail: openingKeywords },
    { item: "closing_has_all_keywords", pass: closingKeywords.length === keywords.length, detail: closingKeywords },
    { item: "keyword_stuffing", pass: repeatedKeywords.length === 0, detail: repeatedKeywords },
    { item: "contact_risk_detected", pass: !hasContactRisk(plain) },
    { item: "evidence_markers_present", pass: evidenceHits.length > 0, detail: evidenceHits },
    { item: "has_h1", pass: hasHeading(lines, 1) },
    { item: "has_h2", pass: hasHeading(lines, 2) },
    { item: "has_h3", pass: hasHeading(lines, 3) },
    { item: "has_bullet_or_table", pass: hasBulletOrTable(lines) },
    { item: "has_fact_number", pass: hasNumber(plain) },
    { item: "has_experience_signal", pass: hasFirstPersonOrPractice(plain) },
    { item: "has_citation_signal", pass: citationHits.length > 0, detail: citationHits },
    { item: "has_intent_opening", pass: hasIntentOpening(opening) },
    { item: "low_value_filler_absent", pass: !hasLowValueFiller(plain) },
  ];

  const passed = checks.filter((check) => check.pass).length;
  const result = {
    file: args.file,
    person: args.person,
    keywords,
    title,
    score_hint: Math.round((passed / checks.length) * 100),
    checks,
  };

  console.log(JSON.stringify(result, null, 2));
  if (checks.some((check) => !check.pass)) process.exitCode = 2;
}

main();
