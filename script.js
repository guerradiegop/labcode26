(function () {
  document.documentElement.classList.add("js");
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CHAVE = "floresta-ocorrencias";
  var memoria = [];

  /* Banco local: persistência no navegador; exportação e importação JSON */
  var arquivoHandle = null;
  function dadosLocais() {
    var json = localStorage.getItem(CHAVE);
    if (!json) return [];
    var lista = JSON.parse(json);
    if (!Array.isArray(lista)) throw new Error("Armazenamento local inválido");
    return lista;
  }
  function gravarLocal(lista) {
    // Não apresenta confirmação caso o navegador bloqueie ou esgote armazenamento.
    localStorage.setItem(CHAVE, JSON.stringify(lista));
  }
  function baixarLista(lista) {
    var blob = new Blob([JSON.stringify(lista, null, 2)], { type: "application/json" });
    var link = document.createElement("a"), url = URL.createObjectURL(blob);
    link.href = url; link.download = "ocorrencias.json";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  var Banco = {
    listar: function () { return dadosLocais(); },
    adicionar: function (d) {
      var lista = dadosLocais();
      var token = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + "-" + String(Math.random()).slice(2);
      var reg = { id: token, protocolo: "DES-" + new Date().getFullYear() + "-" + token.replace(/-/g, "").slice(0, 10).toUpperCase(),
        tipo: d.tipo, cidade: "Joinville", uf: "SC", endereco: d.endereco, local: d.local,
        data: d.data, desc: d.desc, anonima: d.anonima, contato: d.anonima ? "" : d.contato,
        criada: new Date().toISOString(), status: "Registrada" };
      lista.unshift(reg); gravarLocal(lista); return reg;
    },
    excluir: function (id) { gravarLocal(dadosLocais().filter(function (r) { return r.id !== id && r.protocolo !== id; })); },
    limpar: function () { gravarLocal([]); },
    importar: function (entrada) {
      if (!Array.isArray(entrada)) throw new Error("O JSON deve conter uma lista de ocorrências.");
      if (entrada.length > 20000) throw new Error("Arquivo com registros demais.");
      var atual = dadosLocais(), protocolos = new Set(atual.map(function (r) { return r.protocolo; })), quantidade = 0;
      entrada.forEach(function (r) {
        if (!r || typeof r !== "object" || Array.isArray(r) || typeof r.protocolo !== "string" || !r.protocolo.trim()) return;
        if (protocolos.has(r.protocolo)) return;
        atual.push(r); protocolos.add(r.protocolo); quantidade++;
      });
      if (quantidade) gravarLocal(atual);
      return quantidade;
    },
    baixarJSON: function () { baixarLista(dadosLocais()); },
    salvarArquivo: async function (handle) {
      var fluxo = await handle.createWritable();
      await fluxo.write(JSON.stringify(dadosLocais(), null, 2) + "\n");
      await fluxo.close();
    }
  };
  var views = ["inicio", "denuncia", "ocorrencias"];
  var tipos = [];

  /* ---------- Floresta animada no topo ---------- */
  (function () {
    var NS = "http://www.w3.org/2000/svg", g = $("trees"), x = 10, i = 0;
    function el(name, attrs, cls) {
      var e = document.createElementNS(NS, name);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      if (cls) e.setAttribute("class", cls);
      return e;
    }
    while (x < 1040) {
      var h = 70 + ((i * 37) % 60), w = 26 + ((i * 13) % 16);
      var stump = x > 800 + ((i * 29) % 80);
      var delay = (i * 0.045).toFixed(2) + "s";
      if (stump) {
        g.appendChild(el("rect", { x: x, y: 156, width: 14, height: 14 }, "stump"));
      } else {
        var t = el("rect", { x: x + w / 2 - 3, y: 146, width: 6, height: 24 }, "trunk");
        var c = el("polygon", { points: x + "," + 152 + " " + (x + w) + ",152 " + (x + w / 2) + "," + (152 - h) }, "tree");
        t.style.animationDelay = c.style.animationDelay = delay;
        g.appendChild(t); g.appendChild(c);
      }
      x += w + 6; i++;
    }
  })();

  /* ---------- Revelar ao rolar ---------- */
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.15 }) : null;
  function observar() {
    document.querySelectorAll(".reveal:not(.in)").forEach(function (el, n) {
      el.style.setProperty("--d", ((n % 5) * 0.07) + "s");
      if (io) io.observe(el); else el.classList.add("in");
    });
  }

  /* ---------- Sombra do cabeçalho ---------- */
  window.addEventListener("scroll", function () {
    $("topo").classList.toggle("scrolled", window.scrollY > 10);
  }, { passive: true });

  /* ---------- Rotas por hash ---------- */
  function show(v) {
    views.forEach(function (n) { $("v-" + n).classList.toggle("on", n === v); });
    document.querySelectorAll("[data-nav]").forEach(function (a) {
      if (a.dataset.nav === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (v === "ocorrencias") carregar();
    if (v !== "denuncia") $("confirm").hidden = true;
    observar();
  }
  function route() {
    var h = (location.hash || "#inicio").slice(1);
    if (views.indexOf(h) < 0) {
      if (h && $(h)) { show("inicio"); $(h).scrollIntoView(); return; }
      h = "inicio";
    }
    show(h); window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  document.querySelectorAll("[data-scroll]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      $(a.dataset.scroll).scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    });
  });

  /* ---------- Campos do formulário ---------- */
  Array.prototype.slice.call($("tipo").options, 1).forEach(function (o) {
    tipos.push(o.value);
    var f = document.createElement("option"); f.value = f.textContent = o.value; $("filtro").appendChild(f);
  });
  function hojeLocal() {
    var d = new Date(), y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dia = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + dia;
  }
  $("data").max = hojeLocal();
  $("anon").addEventListener("change", function () {
    $("contato").hidden = $("anon").checked;
    if ($("anon").checked) $("nome").value = "";
  });

  /* ---------- Envio do formulário ---------- */
  function erro(campo, msg) {
    $("e-" + campo).textContent = msg || "";
    var input = $(campo);
    input.classList.remove("invalid");
    if (msg) { void input.offsetWidth; input.classList.add("invalid"); }
  }
  function aviso(titulo, texto, falha, link) {
    var c = $("confirm"); c.hidden = false; c.className = "ok" + (falha ? " fail" : ""); c.innerHTML = "";
    var s = document.createElement("strong"); s.textContent = titulo;
    var p = document.createElement("p"); p.style.margin = "0"; p.textContent = texto;
    c.appendChild(s); c.appendChild(p);
    if (link) { var a = document.createElement("a"); a.href = "#ocorrencias"; a.className = "btn small"; a.textContent = "Ver ocorrências registradas"; c.appendChild(a); }
    c.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }
  $("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var d = { tipo: $("tipo").value, cidade: "Joinville", uf: "SC", endereco: $("endereco").value.trim(), local: $("local").value.trim(),
              data: $("data").value, desc: $("desc").value.trim(), anonima: $("anon").checked, contato: $("nome").value.trim() };
    var ruim = false;
    function chk(cond, campo, msg) { erro(campo, cond ? "" : msg); if (!cond) ruim = true; }
    chk(!!d.tipo, "tipo", "Escolha o tipo de ocorrência.");
    chk(d.cidade === "Joinville", "cidade", "Município inválido.");
    chk(d.uf === "SC", "uf", "Estado inválido.");
    chk(d.endereco.length >= 5, "endereco", "Informe um endereço com pelo menos 5 caracteres.");
    chk(!!d.data && d.data <= hojeLocal(), "data", "Informe uma data válida, não futura.");
    chk(d.desc.length >= 10, "desc", "Descreva com pelo menos 10 caracteres.");
    if (ruim) return;

    $("enviar").disabled = true;
    try {
      var reg = await Banco.adicionar(d);
      aviso("Denúncia registrada", "Seu protocolo é " + reg.protocolo + ". Os dados foram salvos neste navegador. Para manter uma cópia na pasta do projeto, use Salvar JSON na aba Ocorrências. Para fiscalização oficial, envie também ao Ibama (0800 061 8080).", false, true);
      $("form").reset(); $("contato").hidden = true;
    } catch (e) {
      aviso("Não foi possível registrar", e.message + " Verifique o espaço e as permissões de armazenamento do Chrome.", true, false);
    } finally { $("enviar").disabled = false; }
  });

  /* ---------- Listagem ---------- */
  var dados = [];
  function contar(el, alvo) {
    if (reduce || alvo === 0) { el.textContent = alvo; return; }
    var ini = null;
    function passo(t) {
      if (ini === null) ini = t;
      var p = Math.min((t - ini) / 700, 1);
      el.textContent = Math.round(alvo * p);
      if (p < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }
  function td(tr, txt) { var c = document.createElement("td"); c.textContent = txt; tr.appendChild(c); }
  function fmt(iso) { var p = iso.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; }

  async function carregar() {
    try { dados = await Banco.listar(); desenhar(); }
    catch (e) { $("tabela").textContent = "Erro ao carregar registros: " + e.message; }
  }
  function desenhar() {
    var f = $("filtro").value;
    var lista = f ? dados.filter(function (r) { return r.tipo === f; }) : dados;
    var st = $("stats"); st.innerHTML = "";
    function stat(n, rot) {
      var d = document.createElement("div"); d.className = "stat";
      var b = document.createElement("b"); d.appendChild(b); d.appendChild(document.createTextNode(rot));
      st.appendChild(d); contar(b, n);
    }
    stat(dados.length, "total de ocorrências");
    tipos.forEach(function (t) {
      var n = dados.filter(function (r) { return r.tipo === t; }).length;
      if (n) stat(n, t);
    });
    var box = $("tabela"); box.innerHTML = "";
    if (!lista.length) {
      var e = document.createElement("div"); e.className = "empty";
      e.textContent = dados.length ? "Nenhuma ocorrência desse tipo." : "Nenhuma ocorrência registrada ainda. Use o botão “Nova denúncia” para registrar a primeira.";
      box.appendChild(e); return;
    }
    var t = document.createElement("table");
    var hr = t.createTHead().insertRow();
    ["Protocolo", "Tipo", "Local", "Data", "Autoria", ""].forEach(function (h) {
      var th = document.createElement("th"); th.textContent = h; hr.appendChild(th);
    });
    var tb = t.createTBody();
    lista.forEach(function (r, i) {
      var tr = tb.insertRow(); tr.style.setProperty("--d", Math.min(i * 0.04, 0.6) + "s");
      td(tr, r.protocolo); td(tr, r.tipo);
      td(tr, (r.endereco ? r.endereco + " – " : "") + (r.cidade || "") + "/" + (r.uf || "") + (r.local ? " – " + r.local : ""));
      td(tr, fmt(r.data)); td(tr, r.anonima ? "Anônima" : "Identificada");
      var c = document.createElement("td"), b = document.createElement("button");
      b.type = "button"; b.className = "btn small alt"; b.textContent = "Excluir";
      b.setAttribute("aria-label", "Excluir ocorrência " + r.protocolo);
      b.addEventListener("click", async function () {
        if (!confirm("Excluir ocorrência " + r.protocolo + "?")) return;
        try { await Banco.excluir(r.id || r.protocolo); await carregar(); }
        catch (e) { alert("Erro ao excluir: " + e.message); }
      });
      c.appendChild(b); tr.appendChild(c);
    });
    box.appendChild(t);
  }
  $("filtro").addEventListener("change", desenhar);
  $("baixar").addEventListener("click", function () {
    try { Banco.baixarJSON(); } catch (e) { alert("Falha ao baixar JSON: " + e.message); }
  });
  $("salvar-json").addEventListener("click", async function () {
    try {
      if (window.showSaveFilePicker) {
        // O seletor deve ser aberto diretamente no clique.
        if (!arquivoHandle) arquivoHandle = await window.showSaveFilePicker({
          suggestedName: "ocorrencias.json",
          types: [{ description: "Dados JSON", accept: { "application/json": [".json"] } }]
        });
        await Banco.salvarArquivo(arquivoHandle);
        alert("JSON salvo no arquivo escolhido. Use este botão para atualizar a mesma cópia.");
      } else {
        Banco.baixarJSON();
        alert("O Chrome baixou ocorrencias.json. Mova o arquivo para a pasta do projeto no app Arquivos.");
      }
    } catch (e) {
      if (e.name !== "AbortError") alert("Não foi possível salvar: " + e.message + ". Use Baixar JSON como alternativa.");
    }
  });
  $("importar").addEventListener("change", async function () {
    var arq = this.files && this.files[0];
    if (!arq) return;
    try {
      if (arq.size > 5 * 1024 * 1024) throw new Error("Arquivo maior que 5 MB.");
      var entrada = JSON.parse(await arq.text());
      var total = Banco.importar(entrada);
      alert(total + " ocorrência(s) importada(s). Duplicados preservados sem alteração.");
      carregar();
    } catch (e) { alert("Erro ao importar: " + e.message); }
    finally { this.value = ""; }
  });
  $("limpar").addEventListener("click", function () {
    if (!confirm("Apagar todos os registros deste navegador? Salve antes uma cópia JSON. Esta ação é irreversível.")) return;
    try { Banco.limpar(); carregar(); }
    catch (e) { alert("Falha ao apagar: " + e.message); }
  });

  route();
})();