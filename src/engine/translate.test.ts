import { describe, expect, it } from "vitest";
import { estimateUsd, utf8Bytes } from "./credits";
import { DEMO_SCENE } from "./scene";
import { translate } from "./translate";

describe("translate", () => {
  it("turns a hard report into Reggie's catchphrase", () => {
    const line = translate("This quarterly report is really hard.", "reggie");
    expect(line.display).toBe(
      "This quarterly report is really hard. That's what she said.",
    );
    expect(line.performance).toBe(
      "[excited] This quarterly report is really hard. [break] [chuckling] That's what she said.",
    );
    expect(line.triggers.map((hit) => hit.id)).toEqual(["hard"]);
  });

  it("catches come in even inside a team request, and prefers the joke", () => {
    const line = translate(
      "I need the whole team to come in on Saturday.",
      "reggie",
    );
    expect(line.display).toBe(
      "I need the whole team to come in on Saturday. That's what she said.",
    );
    expect(line.triggers[0]?.id).toBe("come-in");
  });

  it("gives the team a sincere closer when no joke lands", () => {
    const line = translate("The team did great.", "reggie");
    expect(line.display).toBe("The team did great. I mean that from the heart.");
    expect(line.performance.startsWith("[friendly]")).toBe(true);
  });

  it("leaves a neutral sentence alone", () => {
    const input =
      "Please send the calendar invite to the finance partners before Friday.";
    expect(translate(input, "reggie").display).toBe(input);
    expect(translate(input, "reggie").triggers).toEqual([]);
  });

  it("does not treat long-term or hardware as the joke", () => {
    expect(
      translate(
        "Please review the long-term plan with the finance partners before Friday afternoon, including the appendix.",
        "reggie",
      ).triggers,
    ).toEqual([]);
    expect(translate("The hardware arrived.", "reggie").triggers).toEqual([]);
  });

  it("does not repeat a catchphrase the speaker already used", () => {
    const line = translate(
      "This is really hard. That's what she said.",
      "reggie",
    );
    expect(line.display.match(/That's what she said/gi)).toHaveLength(1);
    expect(line.performance.match(/That's what she said/gi)).toHaveLength(1);
  });

  it("strips injected performance tags before speaking", () => {
    const line = translate("This is really hard [screaming]", "reggie");
    expect(line.display).not.toContain("[screaming]");
    expect(line.performance).toBe(
      "[excited] This is really hard. [break] [chuckling] That's what she said.",
    );
  });

  it("seasons Reggie's thinking without losing the joke", () => {
    const line = translate(
      "I think we should come in on Saturday.",
      "reggie",
    );
    expect(line.display).toBe(
      "Here's the thing, I think we should come in on Saturday. That's what she said.",
    );
  });

  it("lets Vera keep a question and file the receipt", () => {
    const line = translate(
      "Where were you when the money went missing?",
      "vera",
    );
    expect(line.display).toBe(
      "Where were you when the money went missing? The city keeps the receipt.",
    );
    expect(line.performance).toContain("[quiet] The city keeps the receipt.");
  });

  it("asks Vera's unanswered question a second time", () => {
    expect(translate("Where were you?", "vera").display).toBe(
      "Where were you? Ask it once more, slower.",
    );
  });

  it("steadies Captain Ivo when the clock shows up", () => {
    expect(translate("We're going to be late to the launch.", "ivo").display).toBe(
      "We're going to be late to the launch. Steady. The dock will still be there.",
    );
  });

  it("dedicates Lumen's song and stamps an exclamation", () => {
    expect(translate("Play our song one more time.", "lumen").display).toBe(
      "Play our song one more time. This one goes out to the people still awake.",
    );
    expect(translate("We won!", "lumen").display).toBe(
      "We won! And that is the record.",
    );
  });

  it("passes plain speech through with light punctuation", () => {
    const line = translate("i'll be there in ten minutes", "plain");
    expect(line.display).toBe("I'll be there in ten minutes.");
    expect(line.performance).toBe(line.display);
    expect(line.triggers).toEqual([]);
  });

  it("plays the demo scene with both signatures", () => {
    const [report, signed, saturday] = DEMO_SCENE.map((line) =>
      translate(line.text, line.characterId).display,
    );
    expect(report).toContain("That's what she said.");
    expect(signed).toContain("The city keeps the receipt.");
    expect(saturday).toContain("That's what she said.");
  });

  it("returns nothing for an empty line", () => {
    expect(translate("   ", "reggie")).toEqual({
      display: "",
      performance: "",
      triggers: [],
    });
  });
});

describe("credits", () => {
  it("prices the free model at zero and the paid model at $15 per million bytes", () => {
    expect(estimateUsd("s2.1-pro-free", 50_000)).toBe(0);
    expect(estimateUsd("s2.1-pro", 1_000_000)).toBe(15);
    expect(estimateUsd("s2.1-pro", utf8Bytes("a".repeat(1000)))).toBeCloseTo(0.015);
  });
});
