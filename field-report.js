/*
 * R-MALOWA SENA 2.0 — RELATÓRIO DE CAMPO
 * Registo e totalização por GRUPO + CATEGORIA (não por pessoa).
 *
 * Integração depois do login:
 * RMFieldReport.init({
 *   supabase: SB,
 *   getGroups: function(){ return S.groups; },
 *   getUser: function(){ return { id: UID, email: EMAIL, isAdmin: ADMIN }; }
 * });
 *
 * A tabela field_reports utiliza o formato id + d (JSON), compatível
 * com a estrutura de armazenamento já usada pelo projeto.
 */
(function (global) {
  "use strict";

  var MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  var CATEGORIES = [
    { key: "pioneiros_regulares", label: "Pioneiros regulares" },
    { key: "pioneiros_auxiliares", label: "Pioneiros auxiliares" },
    { key: "publicadores", label: "Publicadores" }
  ];

  var cfg = null;
  var reports = [];
  var selectedGroup = "";
  var selectedMonth = new Date().getMonth();
  var selectedYear = new Date().getFullYear();

  function el(tag, attrs, html) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "className") node.className = attrs[key];
      else if (key === "text") node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  function safe(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function id() {
    return "fc_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  function groupList() {
    return (cfg.getGroups && cfg.getGroups()) || [];
  }

  function currentGroup() {
    return groupList().find(function (g) { return String(g.id) === String(selectedGroup); });
  }

  function groupName(groupId) {
    var g = groupList().find(function (x) { return String(x.id) === String(groupId); });
    return g ? g.nome : "Grupo removido";
  }

  function toast(message) {
    var box = document.getElementById("rm-field-message");
    if (!box) return;
    box.textContent = message;
    box.hidden = false;
    window.clearTimeout(toast._timer);
    toast._timer = window.setTimeout(function () { box.hidden = true; }, 3500);
  }

  function totals(groupId, category, month, year) {
    return reports.filter(function (r) {
      return String(r.groupId) === String(groupId) &&
        r.category === category &&
        Number(r.month) === Number(month) &&
        Number(r.year) === Number(year);
    }).reduce(function (sum, r) {
      sum.hours += Number(r.hours || 0);
      sum.studies += Number(r.studies || 0);
      return sum;
    }, { hours: 0, studies: 0 });
  }

  function groupTotals(groupId, month, year) {
    return CATEGORIES.map(function (c) {
      var t = totals(groupId, c.key, month, year);
      return { category: c, hours: t.hours, studies: t.studies };
    });
  }

  async function load() {
    var result = await cfg.supabase.from("field_reports").select("id,d");
    if (result.error) throw result.error;
    reports = (result.data || []).map(function (row) { return row.d; }).filter(Boolean);
    render();
  }

  async function saveReport(data) {
    var user = (cfg.getUser && cfg.getUser()) || {};
    var payload = Object.assign({}, data, {
      id: id(),
      createdAt: new Date().toISOString(),
      createdBy: user.id || null,
      createdByEmail: user.email || ""
    });
    var result = await cfg.supabase.from("field_reports").insert({ id: payload.id, d: payload });
    if (result.error) throw result.error;
    reports.push(payload);
    render();
    toast("Relatório de campo guardado.");
  }

  async function deleteReport(reportId) {
    var user = (cfg.getUser && cfg.getUser()) || {};
    if (!user.isAdmin) {
      toast("Só o administrador pode eliminar registos.");
      return;
    }
    var result = await cfg.supabase.from("field_reports").delete().eq("id", reportId);
    if (result.error) throw result.error;
    reports = reports.filter(function (r) { return r.id !== reportId; });
    render();
    toast("Registo eliminado.");
  }

  function render() {
    var root = document.getElementById("rm-field-report-root");
    if (!root) return;

    var groups = groupList();
    if (!groups.length) {
      root.innerHTML = '<section class="rmfc-card"><h2>RELATÓRIO DE CAMPO</h2><p>Primeiro, registe um grupo na área Grupos.</p></section>';
      return;
    }
    if (!groups.some(function (g) { return String(g.id) === String(selectedGroup); })) {
      selectedGroup = String(groups[0].id);
    }

    var user = (cfg.getUser && cfg.getUser()) || {};
    var gOptions = groups.map(function (g) {
      return '<option value="' + safe(g.id) + '"' + (String(g.id) === String(selectedGroup) ? " selected" : "") + '>' + safe(g.nome) + '</option>';
    }).join("");
    var monthOptions = MONTHS.map(function (m, i) {
      return '<option value="' + i + '"' + (i === selectedMonth ? " selected" : "") + '>' + m + '</option>';
    }).join("");

    var summary = groupTotals(selectedGroup, selectedMonth, selectedYear);
    var totalHours = summary.reduce(function (s, x) { return s + x.hours; }, 0);
    var totalStudies = summary.reduce(function (s, x) { return s + x.studies; }, 0);

    var rows = summary.map(function (x) {
      return '<tr><td>' + safe(x.category.label) + '</td><td class="num">' +
        x.hours.toLocaleString("pt-PT") + ' h</td><td class="num">' +
        x.studies.toLocaleString("pt-PT") + '</td></tr>';
    }).join("");

    var history = reports.filter(function (r) {
      return String(r.groupId) === String(selectedGroup) &&
        Number(r.month) === selectedMonth && Number(r.year) === selectedYear;
    }).sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });

    var historyRows = history.map(function (r) {
      var category = CATEGORIES.find(function (c) { return c.key === r.category; });
      return '<tr><td>' + safe(category ? category.label : r.category) + '</td><td class="num">' +
        Number(r.hours || 0).toLocaleString("pt-PT") + ' h</td><td class="num">' +
        Number(r.studies || 0).toLocaleString("pt-PT") + '</td><td>' +
        safe(r.note || "—") + '</td><td>' +
        (user.isAdmin ? '<button type="button" class="rmfc-delete" data-delete="' + safe(r.id) + '">Eliminar</button>' : "—") +
        '</td></tr>';
    }).join("");

    root.innerHTML =
      '<section class="rmfc-card">' +
        '<div class="rmfc-heading"><div><p class="rmfc-eyebrow">R-MALOWA SENA 2.0</p><h2>RELATÓRIO DE CAMPO</h2>' +
        '<p class="rmfc-muted">Totais do grupo, separados por categoria — não por pessoa.</p></div></div>' +
        '<div class="rmfc-filters">' +
          '<label>Grupo<select id="rmfc-group">' + gOptions + '</select></label>' +
          '<label>Mês<select id="rmfc-month">' + monthOptions + '</select></label>' +
          '<label>Ano<input id="rmfc-year" type="number" min="2020" max="2100" value="' + selectedYear + '"></label>' +
        '</div>' +
      '</section>' +
      '<section class="rmfc-stats">' +
        '<article class="rmfc-stat"><span>Total de horas do grupo</span><strong>' + totalHours.toLocaleString("pt-PT") + ' h</strong></article>' +
        '<article class="rmfc-stat"><span>Total de estudos dirigidos</span><strong>' + totalStudies.toLocaleString("pt-PT") + '</strong></article>' +
      '</section>' +
      '<section class="rmfc-card"><h3>Resumo por categoria — ' + safe(groupName(selectedGroup)) + '</h3>' +
        '<div class="rmfc-table-wrap"><table class="rmfc-table"><thead><tr><th>Categoria</th><th class="num">Horas</th><th class="num">Estudos dirigidos</th></tr></thead>' +
        '<tbody>' + rows + '</tbody><tfoot><tr><td>Total do grupo</td><td class="num">' + totalHours.toLocaleString("pt-PT") +
        ' h</td><td class="num">' + totalStudies.toLocaleString("pt-PT") + '</td></tr></tfoot></table></div>' +
      '</section>' +
      '<section class="rmfc-card"><h3>Adicionar registo mensal do grupo</h3>' +
        '<p class="rmfc-muted">Introduza os totais da categoria para este grupo. Se houver mais de um registo no mês, o sistema soma-os automaticamente.</p>' +
        '<form id="rmfc-form">' +
          '<label>Categoria<select id="rmfc-category" required>' + CATEGORIES.map(function (c) { return '<option value="' + c.key + '">' + c.label + '</option>'; }).join("") + '</select></label>' +
          '<div class="rmfc-form-grid"><label>Total de horas<input id="rmfc-hours" type="number" min="0" step="0.25" required placeholder="Ex.: 12"></label>' +
          '<label>Estudos dirigidos<input id="rmfc-studies" type="number" min="0" step="1" required placeholder="Ex.: 3"></label></div>' +
          '<label>Observação (opcional)<input id="rmfc-note" maxlength="250" placeholder="Observação do grupo"></label>' +
          '<button type="submit">Guardar registo</button>' +
        '</form>' +
      '</section>' +
      '<section class="rmfc-card"><h3>Registos deste mês</h3>' +
        '<div class="rmfc-table-wrap"><table class="rmfc-table"><thead><tr><th>Categoria</th><th class="num">Horas</th><th class="num">Estudos</th><th>Observação</th><th>Ação</th></tr></thead>' +
        '<tbody>' + (historyRows || '<tr><td colspan="5">Ainda não existem registos para este período.</td></tr>') + '</tbody></table></div>' +
        '<p class="rmfc-muted">Os totais são calculados automaticamente a partir dos registos guardados no grupo e no período selecionado.</p>' +
      '</section>';

    document.getElementById("rmfc-group").addEventListener("change", function (e) {
      selectedGroup = e.target.value; render();
    });
    document.getElementById("rmfc-month").addEventListener("change", function (e) {
      selectedMonth = Number(e.target.value); render();
    });
    document.getElementById("rmfc-year").addEventListener("change", function (e) {
      var y = Number(e.target.value);
      if (y >= 2020 && y <= 2100) { selectedYear = y; render(); }
    });
    document.getElementById("rmfc-form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var hours = Number(document.getElementById("rmfc-hours").value);
      var studies = Number(document.getElementById("rmfc-studies").value);
      if (!Number.isFinite(hours) || hours < 0 || !Number.isInteger(studies) || studies < 0) {
        toast("Verifique as horas e o número de estudos.");
        return;
      }
      try {
        await saveReport({
          groupId: selectedGroup,
          category: document.getElementById("rmfc-category").value,
          month: selectedMonth,
          year: selectedYear,
          hours: hours,
          studies: studies,
          note: document.getElementById("rmfc-note").value.trim()
        });
      } catch (err) {
        console.error(err);
        toast("Não foi possível guardar. Verifique a ligação e as permissões do Supabase.");
      }
    });
    root.querySelectorAll("[data-delete]").forEach(function (button) {
      button.addEventListener("click", function () {
        if (window.confirm("Tem a certeza de que deseja eliminar este registo?")) {
          deleteReport(button.getAttribute("data-delete")).catch(function (err) {
            console.error(err); toast("Não foi possível eliminar o registo.");
          });
        }
      });
    });
  }

  function init(options) {
    if (!options || !options.supabase || typeof options.getGroups !== "function") {
      throw new Error("Configuração do Relatório de Campo incompleta.");
    }
    cfg = options;
    var root = document.getElementById("rm-field-report-root");
    if (!root) {
      root = el("div", { id: "rm-field-report-root" });
      var app = document.getElementById("app") || document.body;
      app.appendChild(root);
    }
    injectStyles();
    load().catch(function (err) {
      console.error(err);
      root.innerHTML = '<section class="rmfc-card"><h2>RELATÓRIO DE CAMPO</h2><p>Não foi possível carregar os registos. Confirme se executou a migração SQL e se o utilizador tem acesso.</p></section>';
    });

    // Atualização em tempo real entre representantes.
    cfg.supabase.channel("rm-field-reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "field_reports" }, function () {
        load().catch(function (err) { console.error(err); });
      }).subscribe();

    document.querySelectorAll("[data-rm-field-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        root.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function injectStyles() {
    if (document.getElementById("rmfc-style")) return;
    var css = [
      "#rm-field-report-root{max-width:1100px;margin:0 auto 32px;padding:12px;color:var(--tx,#15211b);font:16px/1.45 system-ui,sans-serif}",
      ".rmfc-card{background:var(--sf,#fff);border:1px solid var(--ln,#d5ded8);border-radius:14px;padding:16px;margin:0 0 14px}",
      ".rmfc-heading{display:flex;justify-content:space-between;gap:12px;align-items:center}",
      ".rmfc-eyebrow{font-size:.75rem;letter-spacing:.12em;color:var(--ac,#0b6b4f);font-weight:700;margin:0}",
      ".rmfc-card h2{font-size:1.35rem;margin:4px 0}.rmfc-card h3{font-size:1.05rem;margin:0 0 12px}",
      ".rmfc-muted{color:var(--mu,#5b6b62);font-size:.9rem;margin:5px 0 12px}",
      ".rmfc-filters,.rmfc-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}",
      ".rmfc-card label{display:block;font-size:.88rem;color:var(--mu,#5b6b62);margin:8px 0}",
      ".rmfc-card input,.rmfc-card select{display:block;width:100%;min-height:42px;padding:9px;border:1px solid var(--ln,#d5ded8);border-radius:8px;background:var(--bg,#f4f7f4);color:var(--tx,#15211b);font:inherit;margin-top:4px}",
      ".rmfc-card button{margin-top:10px;min-height:42px;padding:9px 16px;border:0;border-radius:8px;background:var(--ac,#0b6b4f);color:white;font:inherit;font-weight:700;cursor:pointer}",
      ".rmfc-card .rmfc-delete{background:transparent;color:#b3261e;border:1px solid #b3261e;padding:5px 8px;min-height:32px;margin:0}",
      ".rmfc-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:14px}",
      ".rmfc-stat{padding:16px;border-radius:14px;background:var(--ac2,#e8f3ee);border:1px solid var(--ln,#d5ded8)}",
      ".rmfc-stat span{display:block;color:var(--mu,#5b6b62);font-size:.88rem}.rmfc-stat strong{display:block;font-size:1.7rem;margin-top:5px}",
      ".rmfc-table-wrap{overflow-x:auto}.rmfc-table{width:100%;border-collapse:collapse;min-width:550px}",
      ".rmfc-table th,.rmfc-table td{padding:10px 8px;border-bottom:1px solid var(--ln,#d5ded8);text-align:left}",
      ".rmfc-table th{color:var(--mu,#5b6b62);font-size:.85rem}.rmfc-table .num{text-align:right;font-variant-numeric:tabular-nums}",
      ".rmfc-table tfoot td{font-weight:700;background:var(--ac2,#e8f3ee)}",
      "#rm-field-message{position:fixed;bottom:16px;left:16px;right:16px;z-index:9999;background:#15211b;color:white;padding:12px 16px;border-radius:10px}",
      "@media(max-width:600px){#rm-field-report-root{padding:8px}.rmfc-card{padding:12px}.rmfc-stat strong{font-size:1.45rem}}"
    ].join("");
    var style = el("style", { id: "rmfc-style" }, css);
    document.head.appendChild(style);
    if (!document.getElementById("rm-field-message")) {
      var message = el("div", { id: "rm-field-message", role: "status" });
      message.hidden = true;
      document.body.appendChild(message);
    }
  }

  global.RMFieldReport = { init: init, reload: load };
})(window);
