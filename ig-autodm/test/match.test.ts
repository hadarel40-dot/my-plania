import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMessage, matchesKeyword, normalize, parseKeywords, validateRuleInput } from "../src/match.ts";

test("התאמה חלקית ובלי רגישות לאותיות", () => {
  const kw = parseKeywords("מדריך, מדרך ,Guide");
  assert.deepEqual(kw, ["מדריך", "מדרך", "guide"]);
  assert.ok(matchesKeyword("אני רוצה את המדריך!!", kw));
  assert.ok(matchesKeyword("GUIDE please", kw));
  assert.ok(matchesKeyword("מְדְרִיךְ", kw), "ניקוד");
  assert.ok(matchesKeyword("‏מדריך", kw), "תו כיווניות");
  assert.ok(!matchesKeyword("וואו איזה יופי", kw));
  assert.ok(!matchesKeyword("", kw));
});

test("שם בהודעה", () => {
  assert.equal(buildMessage("היי {שם}! הנה", "noa", true), "היי noa! הנה");
  assert.equal(buildMessage("היי {שם}! הנה", "noa", false), "היי! הנה");
  assert.equal(buildMessage("היי { name }, הנה", "", true), "היי, הנה");
});

test("בדיקת טופס", () => {
  const ok = { media_id: "123", keywords: "a", message: "x", button_title: "למדריך", button_url: "https://a.co" };
  assert.deepEqual(validateRuleInput(ok), []);
  assert.equal(validateRuleInput({ ...ok, button_url: "http://a.co" }).length, 1);
  assert.equal(validateRuleInput({ ...ok, button_title: "x".repeat(21) }).length, 1);
  assert.equal(validateRuleInput({ ...ok, media_id: "" }).length, 1);
  assert.equal(normalize("  A  b "), "a b");
});
