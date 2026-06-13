---
name: prompt-writing
description: Write effective prompts and system prompts for LLMs.
version: 1.0
---

# Prompt writing

- **State the role and goal** plainly. What is the model, what is it optimizing for, what does success look like.
- **Be specific about the task and the output.** Describe the desired format, length, and structure. If you need machine-readable output, specify the exact schema and ask for that and nothing else.
- **Show, don't just tell.** One or two good examples (few-shot) usually beat paragraphs of instruction. Positive examples ("do it like this") tend to work better than long lists of don'ts.
- **Put stable content first, volatile content last.** For caching and clarity, keep the fixed instructions at the top and the per-request question at the end.
- **Give the reasoning room** for hard tasks (let it think/plan), and ask for a final answer separately so the output stays clean.
- **Constrain failure modes** you actually see — over-verbosity, hedging, refusing benign work, hallucinating sources — with targeted lines, not blanket "be perfect."
- **Avoid over-prescription.** Modern models follow instructions closely; aggressive "CRITICAL: YOU MUST" language causes over-triggering. State the goal and trust the model; tighten only where it actually drifts.
- **Iterate against real cases.** Test the prompt on representative and adversarial inputs; change one thing at a time.
