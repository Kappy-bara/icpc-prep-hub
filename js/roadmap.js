/**
 * Roadmap rendering + progress calculations. Checkbox state persists in
 * Store.data.roadmapProgress, keyed by topic id.
 */
const HIT_SCORE_META = {
  5: { label: "Essential", className: "hit-score-5" },
  4: { label: "High Priority", className: "hit-score-4" },
  3: { label: "Useful", className: "hit-score-3" },
  2: { label: "Situational", className: "hit-score-2" },
  1: { label: "Rare", className: "hit-score-1" },
};

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

  /** Compact overall-progress + per-phase summary for the Dashboard, with a link to the full checklist. */
  renderSummary(container) {
    if (!container) return;
    const overall = this.overallProgress();
    const buckets = this.phaseBuckets();
    container.innerHTML = `
      <div class="progress-row">
        <div class="progress-bar"><div class="progress-fill" style="width:${overall.percent}%"></div></div>
        <span class="progress-label">${overall.done} / ${overall.total} topics (${overall.percent}%)</span>
      </div>
      <div class="report-windows">
        ${buckets
          .map(
            (b) => `
          <div class="stat-tile">
            <div class="stat-value">${b.percent}%</div>
            <div class="stat-label">${escapeHtml(b.phase)} (${b.done}/${b.total})</div>
          </div>`
          )
          .join("")}
      </div>
      <p class="card-subtitle"><a href="roadmap.html">View full roadmap &rarr;</a></p>
    `;
  },

  /** id of the subject currently shown in the detail pane; persists across re-renders within a page view. */
  _selectedSubjectId: null,

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

    if (!this._selectedSubjectId || !ROADMAP.some((s) => s.id === this._selectedSubjectId)) {
      this._selectedSubjectId = ROADMAP[0].id;
    }

    const layout = document.createElement("div");
    layout.className = "roadmap-layout";
    container.appendChild(layout);

    const nav = document.createElement("nav");
    nav.className = "subject-nav";
    nav.setAttribute("aria-label", "Subjects");
    layout.appendChild(nav);

    ROADMAP.forEach((subject) => {
      const sp = this.subjectProgress(subject);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "subject-nav-item" + (subject.id === this._selectedSubjectId ? " active" : "");
      btn.innerHTML = `
        <span class="subject-nav-top">
          <span class="subject-nav-name">${escapeHtml(subject.name)}</span>
          <span class="subject-nav-count">${sp.done}/${sp.total}</span>
        </span>
        <div class="progress-bar subject-nav-bar"><div class="progress-fill" style="width:${sp.percent}%"></div></div>
      `;
      btn.addEventListener("click", () => {
        this._selectedSubjectId = subject.id;
        this.render(container);
      });
      nav.appendChild(btn);
    });

    const subject = ROADMAP.find((s) => s.id === this._selectedSubjectId);
    const detail = document.createElement("div");
    detail.className = "card subject-detail";
    layout.appendChild(detail);

    const heading = document.createElement("h3");
    heading.className = "subject-detail-title";
    heading.textContent = subject.name;
    detail.appendChild(heading);

    const blurb = document.createElement("p");
    blurb.className = "subject-blurb";
    blurb.textContent = subject.blurb;
    detail.appendChild(blurb);

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
        const scoreMeta = HIT_SCORE_META[topic.hitScore];
        if (scoreMeta) {
          const scoreEl = document.createElement("span");
          scoreEl.className = `hit-score ${scoreMeta.className}`;
          scoreEl.textContent = scoreMeta.label;
          scoreEl.title = "How important this topic is for ICPC, based on how often it's a prerequisite for other topics and how often it appears in regionals/World Finals directly.";
          nameEl.appendChild(scoreEl);
        }
        textWrap.appendChild(nameEl);

        if (topic.what) {
          const whatEl = document.createElement("span");
          whatEl.className = "topic-what";
          whatEl.textContent = topic.what;
          textWrap.appendChild(whatEl);
        }

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
      detail.appendChild(phaseEl);
    }
  },
};
