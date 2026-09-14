/**
 * Roadmap rendering + progress calculations. Checkbox state persists in
 * Store.data.roadmapProgress, keyed by topic id.
 */
const Roadmap = {
  allTopics() {
    const out = [];
    for (const subject of ROADMAP) {
      for (const phase of subject.phases) {
        for (const topic of phase.topics) {
          out.push({ ...topic, subjectId: subject.id, subjectName: subject.name, phase: phase.name });
        }
      }
    }
    return out;
  },

  isDone(topicId) {
    return !!Store.data.roadmapProgress[topicId];
  },

  setDone(topicId, done) {
    Store.update((d) => {
      if (done) d.roadmapProgress[topicId] = true;
      else delete d.roadmapProgress[topicId];
    });
  },

  subjectProgress(subject) {
    const topics = subject.phases.flatMap((p) => p.topics);
    const done = topics.filter((t) => this.isDone(t.id)).length;
    return { done, total: topics.length, percent: topics.length ? Math.round((done / topics.length) * 100) : 0 };
  },

  overallProgress() {
    const topics = this.allTopics();
    const done = topics.filter((t) => this.isDone(t.id)).length;
    return { done, total: topics.length, percent: topics.length ? Math.round((done / topics.length) * 100) : 0 };
  },

  /** Group all topics (across every subject) by phase name, in Foundations -> Core -> Advanced order. */
  phaseBuckets() {
    const order = ["Foundations", "Core", "Advanced"];
    const buckets = order.map((name) => ({ phase: name, topics: [] }));
    for (const t of this.allTopics()) {
      const bucket = buckets.find((b) => b.phase === t.phase);
      if (bucket) bucket.topics.push(t);
      else buckets.push({ phase: t.phase, topics: [t] });
    }
    return buckets.map((b) => {
      const done = b.topics.filter((t) => this.isDone(t.id)).length;
      return { ...b, done, total: b.topics.length, percent: b.topics.length ? Math.round((done / b.topics.length) * 100) : 0 };
    });
  },

  render(container) {
    container.innerHTML = "";

    const overall = this.overallProgress();
    const summary = document.createElement("div");
    summary.className = "roadmap-summary";
    summary.innerHTML = `
      <div class="progress-row">
        <div class="progress-bar"><div class="progress-fill" style="width:${overall.percent}%"></div></div>
        <span class="progress-label">${overall.done} / ${overall.total} topics (${overall.percent}%)</span>
      </div>
    `;
    container.appendChild(summary);

    ROADMAP.forEach((subject, idx) => {
      const sp = this.subjectProgress(subject);
      const details = document.createElement("details");
      details.className = "subject-block";
      details.open = idx === 0;

      const summaryEl = document.createElement("summary");
      summaryEl.innerHTML = `
        <span class="subject-title">${subject.name}</span>
        <span class="subject-progress">${sp.done}/${sp.total} · ${sp.percent}%</span>
      `;
      details.appendChild(summaryEl);

      const blurb = document.createElement("p");
      blurb.className = "subject-blurb";
      blurb.textContent = subject.blurb;
      details.appendChild(blurb);

      for (const phase of subject.phases) {
        const phaseEl = document.createElement("div");
        phaseEl.className = "phase-block";
        const phaseHeading = document.createElement("h4");
        phaseHeading.textContent = phase.name;
        phaseEl.appendChild(phaseHeading);

        const list = document.createElement("ul");
        list.className = "topic-list";
        for (const topic of phase.topics) {
          const li = document.createElement("li");
          li.className = "topic-item";

          const label = document.createElement("label");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = this.isDone(topic.id);
          checkbox.addEventListener("change", () => {
            this.setDone(topic.id, checkbox.checked);
            this.render(container);
            document.dispatchEvent(new CustomEvent("roadmap:changed"));
          });
          label.appendChild(checkbox);

          const textWrap = document.createElement("span");
          textWrap.className = "topic-text";
          const nameEl = document.createElement("span");
          nameEl.className = "topic-name";
          nameEl.textContent = topic.name;
          textWrap.appendChild(nameEl);

          const whyEl = document.createElement("span");
          whyEl.className = "topic-why";
          whyEl.textContent = topic.why;
          textWrap.appendChild(whyEl);

          if (topic.resource) {
            const link = document.createElement("a");
            link.className = "topic-resource";
            link.href = topic.resource.url;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.textContent = `→ ${topic.resource.label}`;
            textWrap.appendChild(link);
          }

          label.appendChild(textWrap);
          li.appendChild(label);
          list.appendChild(li);
        }
        phaseEl.appendChild(list);
        details.appendChild(phaseEl);
      }

      container.appendChild(details);
    });
  },
};
