import { describe, expect, it } from "vitest";
import { listCharacters } from "./characters";
import { estimateUsd, utf8Bytes } from "./credits";
import { DEMO_SCENE } from "./scene";
import { translate } from "./translate";

describe("cast", () => {
  it("uses the Dunder Mifflin names", () => {
    expect(listCharacters().map((character) => character.name)).toEqual([
      "Michael Scott",
      "Dwight Schrute",
      "Jim Halpert",
      "Pam Beesly",
    ]);
  });
});

describe("translate", () => {
  it("turns a hard report into Michael Scott's catchphrase", () => {
    const line = translate("This quarterly report is really hard.", "michael");
    expect(line.display).toBe(
      "This quarterly report is really hard. That's what she said.",
    );
    expect(line.performance).toContain("<emphasis>That's what she said.</emphasis>");
    expect(line.performance.startsWith("[eager American office manager")).toBe(true);
    expect(line.triggers.map((hit) => hit.id)).toEqual(["hard"]);
  });

  it("catches come in even inside a team request, and prefers the joke", () => {
    const line = translate(
      "I need the whole team to come in on Saturday.",
      "michael",
    );
    expect(line.display).toBe(
      "I need the whole team to come in on Saturday. That's what she said.",
    );
    expect(line.triggers[0]?.id).toBe("come-in");
  });

  it("gives the team a sincere closer when no joke lands", () => {
    const line = translate("The team did great.", "michael");
    expect(line.display).toBe("The team did great. I am a friend first, and a boss second.");
    expect(line.performance.startsWith("[warm American office manager")).toBe(true);
  });

  it("leaves a neutral sentence alone", () => {
    const input =
      "Please send the calendar invite to the finance partners before Friday.";
    expect(translate(input, "michael").display).toBe(input);
    expect(translate(input, "michael").triggers).toEqual([]);
  });

  it("does not treat long-term or hardware as the joke", () => {
    expect(
      translate(
        "Please review the long-term plan with the finance partners before Friday afternoon, including the appendix.",
        "michael",
      ).triggers,
    ).toEqual([]);
    expect(translate("The hardware arrived.", "michael").triggers).toEqual([]);
  });

  it("does not repeat a catchphrase the speaker already used", () => {
    const line = translate(
      "This is really hard. That's what she said.",
      "michael",
    );
    expect(line.display.match(/That's what she said/gi)).toHaveLength(1);
    expect(line.performance.match(/That's what she said/gi)).toHaveLength(1);
  });

  it("strips injected performance tags before speaking", () => {
    const line = translate("This is really hard [screaming]", "michael");
    expect(line.display).not.toContain("[screaming]");
    expect(line.performance).toContain("<emphasis>That's what she said.</emphasis>");
    expect(line.display).toBe("This is really hard. That's what she said.");
  });

  it("seasons Michael's thinking without losing the joke", () => {
    const line = translate(
      "I think we should come in on Saturday.",
      "michael",
    );
    expect(line.display).toBe(
      "Here's the thing, I think we should come in on Saturday. That's what she said.",
    );
  });

  it("lets Dwight Schrute correct a late report", () => {
    const line = translate("Who signed this, and why are the numbers late?", "dwight");
    expect(line.display).toBe(
      "Who signed this, and why are the numbers late? That is your emergency, not mine.",
    );
    expect(line.performance).toContain("[flat, certain, no smile");
    expect(line.performance).toContain("That is your emergency, not mine.");
  });

  it("makes Dwight say false when the numbers are wrong", () => {
    expect(translate("Those numbers are wrong.", "dwight").display).toBe(
      "Those numbers are wrong. False.",
    );
  });

  it("asks Dwight to hear a question as a fact", () => {
    expect(translate("Where were you?", "dwight").display).toBe(
      "Where were you? Repeat it. As a fact.",
    );
  });

  it("lets Jim Halpert survive a meeting and a win", () => {
    expect(translate("This meeting is going to run long.", "jim").display).toBe(
      "This meeting is going to run long. Yeah, so that happened.",
    );
    expect(translate("We won!", "jim").display).toBe("We won! Then I look at the camera.");
  });

  it("lets Pam Beesly answer from reception and mention art school", () => {
    expect(translate("Hello", "pam").display).toBe("Dunder Mifflin, this is Pam.");
    expect(translate("I might take an art class again.", "pam").display).toBe(
      "I might take an art class again. I went to art school. Sort of.",
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
    expect(signed).toContain("That is your emergency, not mine.");
    expect(saturday).toContain("That's what she said.");
  });

  it("returns nothing for an empty line", () => {
    expect(translate("   ", "michael")).toEqual({
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
    expect(estimateUsd("drama-3", 1_000_000)).toBe(10);
  });
});
