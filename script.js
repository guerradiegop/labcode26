(function () {
  document.documentElement.classList.add("js");
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var CHAVE = "floresta-ocorrencias";
  var memoria = [];

  /* ---------- API local e migração sem apagar registros antigos ---------- */
  async function requisitar(url, opts) {
    var r = await fetch(url, opts || {});
    var j = await r.json();
    if (!r.ok) throw new Error(j.erro || "Falha na comunicação com o servidor.");
    return j;
  }
  var Banco = {
    listar: async function () {
      // Importação idempotente: só remove a cópia local após confirmação do servidor.
      var antigos = [];
      try { antigos = JSON.parse(localStorage.getItem(CHAVE) || "[]"); } catch (e) {}
      if (Array.isArray(antigos) && antigos.length && localStorage.getItem(CHAVE + "-migrado") !== "1") {
        for (var i = 0; i < antigos.length; i += 100) {
          await requisitar("/api/importar", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(antigos.slice(i, i + 100)) });
        }
        // Conserva o backup original; marca somente após resposta de todos os lotes.
        localStorage.setItem(CHAVE + "-migrado", "1");
      }
      return requisitar("/api/ocorrencias");
    },
    adicionar: function (d) { return requisitar("/api/ocorrencias", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d)
    }); },
    excluir: function (id) { return requisitar("/api/ocorrencias/" + encodeURIComponent(id), { method: "DELETE" }); },
    limpar: function () { return requisitar("/api/ocorrencias", { method: "DELETE" }); },
    baixarJSON: async function () {
      var lista = await Banco.listar();
      var blob = new Blob([JSON.stringify(lista, null, 2)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "ocorrencias.json";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
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
    if (v === "denuncia" && mapa) setTimeout(function () { mapa.invalidateSize(); }, 100);
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
  var mapa = null, marcador = null;
  function posicao(lat, lng) {
    $("lat").value = Number(lat).toFixed(6);
    $("lng").value = Number(lng).toFixed(6);
    if (mapa && window.L) {
      if (marcador) mapa.removeLayer(marcador);
      marcador = L.marker([lat, lng]).addTo(mapa);
    }
  }
  if (window.L) {
    mapa = L.map("mapa").setView([-26.3044, -48.8487], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapa);
    mapa.on("click", function (e) {
      var lat = e.latlng.lat, lng = e.latlng.lng;
      if (lat < -26.65 || lat > -25.9 || lng < -49.45 || lng > -48.55) {
        alert("Selecione um ponto na região aproximada de Joinville."); return;
      }
      posicao(lat, lng);
    });
  } else {
    $("mapa").textContent = "Mapa indisponível no momento. Informe o endereço para registrar a ocorrência.";
  }
  $("remover-ponto").addEventListener("click", function () {
    $("lat").value = $("lng").value = "";
    if (mapa && marcador) { mapa.removeLayer(marcador); marcador = null; }
  });
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
              lat: $("lat").value ? Number($("lat").value) : null, lng: $("lng").value ? Number($("lng").value) : null,
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
      aviso("Denúncia registrada", "Seu protocolo é " + reg.protocolo + ". Os dados foram gravados no JSON do servidor local. Para fiscalização oficial, envie também ao Ibama (0800 061 8080).", false, true);
      $("form").reset(); $("contato").hidden = true;
      $("remover-ponto").click();
    } catch (e) {
      aviso("Não foi possível registrar", e.message + " Verifique se o servidor Node está em execução.", true, false);
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
  $("baixar").addEventListener("click", async function () {
    try { await Banco.baixarJSON(); } catch (e) { alert("Erro ao baixar: " + e.message); }
  });
  $("limpar").addEventListener("click", async function () {
    if (!confirm("Apagar TODAS as ocorrências do arquivo JSON no servidor? Esta ação é irreversível.")) return;
    try { await Banco.limpar(); await carregar(); }
    catch (e) { alert("Erro ao apagar: " + e.message); }
  });

  route();
})();