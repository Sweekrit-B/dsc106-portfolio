import { fetchJSON, renderResumeComponents } from "../global.js";

const resume = await fetchJSON("../lib/resume.json");

if (!resume) {
  console.error("Resume data failed to load.");
} else {
  renderResumeComponents(resume);
}
