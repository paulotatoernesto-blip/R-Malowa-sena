/* =====================================================
   R-MALOWA SENA 2.0
   Aplicação principal
   ===================================================== */

let supabaseClient = null;
let utilizadorActual = null;

// ELEMENTOS
const elemento = (id) => document.getElementById(id);

function mensagem(id, texto, erro = false) {
    const campo = elemento(id);
    if (!campo) return;

    campo.textContent = texto;
    campo.style.color = erro ? "#dc2626" : "#15803d";
}

// =====================================================
// INICIALIZAÇÃO DO SUPABASE
// =====================================================

function iniciarSupabase() {
    if (window.supabaseClient) {
        supabaseClient = window.supabaseClient;
    } else if (window.supabase) {
        supabaseClient = window.supabase;
    }

    if (!supabaseClient) {
        console.error("Cliente Supabase não encontrado.");
        mensagem(
            "erro-login",
            "Configuração do Supabase não encontrada. Verifica o ficheiro config.js.",
            true
        );
        return false;
    }

    return true;
}

// =====================================================
// LOGIN
// =====================================================

async function entrar() {
    if (!iniciarSupabase()) return;

    const email = elemento("email")?.value.trim();
    const senha = elemento("senha")?.value;

    if (!email || !senha) {
        mensagem("erro-login", "Preenche o email e a senha.", true);
        return;
    }

    mensagem("erro-login", "A verificar acesso...");

    try {
        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email,
                password: senha
            });

        if (error) throw error;

        utilizadorActual = data.user;

        await abrirAplicacao();

    } catch (erro) {
        console.error(erro);
        mensagem(
            "erro-login",
            "Não foi possível entrar. Verifica os dados de acesso.",
            true
        );
    }
}

// =====================================================
// ABRIR A APLICAÇÃO
// =====================================================

async function abrirAplicacao() {
    if (!utilizadorActual) return;

    if (elemento("login")) {
        elemento("login").style.display = "none";
    }

    if (elemento("aplicacao")) {
        elemento("aplicacao").style.display = "block";
    }

    if (elemento("email-utilizador")) {
        elemento("email-utilizador").textContent =
            utilizadorActual.email || "";
    }

    if (elemento("nome-utilizador")) {
        elemento("nome-utilizador").textContent =
            utilizadorActual.user_metadata?.name ||
            utilizadorActual.email ||
            "Utilizador";
    }

    mensagem("estado-utilizador", "Sessão iniciada");

    await carregarGrupos();
}

// =====================================================
// RESTAURAR SESSÃO
// =====================================================

async function verificarSessao() {
    if (!iniciarSupabase()) return;

    try {
        const { data, error } =
            await supabaseClient.auth.getSession();

        if (error) throw error;

        if (data.session) {
            utilizadorActual = data.session.user;
            await abrirAplicacao();
        }
    } catch (erro) {
        console.error("Erro ao verificar sessão:", erro);
    }
}

// =====================================================
// NAVEGAÇÃO
// =====================================================

function mostrar(secao) {
    document.querySelectorAll(".secao").forEach((item) => {
        item.style.display = "none";
    });

    const destino = elemento(secao);

    if (destino) {
        destino.style.display = "block";
    }
}

// =====================================================
// CARREGAR GRUPOS A-H
// Mantém os grupos existentes em field_groups.
// =====================================================

async function carregarGrupos() {
    if (!supabaseClient) return;

    const lista = elemento("lista-grupos");
    const selectRelatorio = elemento("grupo-relatorio");
    const selectMembro = elemento("grupo-membro");

    if (lista) lista.textContent = "A carregar grupos...";

    try {
        const { data, error } = await supabaseClient
            .from("field_groups")
            .select("*");

        if (error) throw error;

        if (lista) lista.replaceChildren();

        [selectRelatorio, selectMembro].forEach((select) => {
            if (select) {
                select.replaceChildren();
                const opcao = document.createElement("option");
                opcao.value = "";
                opcao.textContent = "Escolher grupo";
                select.appendChild(opcao);
            }
        });

        if (!data || data.length === 0) {
            if (lista) lista.textContent = "Nenhum grupo encontrado.";
            return;
        }

        data.forEach((grupo) => {
            const nome =
                grupo.name ||
                grupo.group_name ||
                grupo.title ||
                grupo.group ||
                grupo.nome ||
                grupo.id;

            if (lista) {
                const item = document.createElement("div");
                item.className = "grupo-item";
                item.textContent = String(nome);
                lista.appendChild(item);
            }

            [selectRelatorio, selectMembro].forEach((select) => {
                if (select) {
                    const opcao = document.createElement("option");
                    opcao.value = grupo.id;
                    opcao.textContent = String(nome);
                    select.appendChild(opcao);
                }
            });
        });

    } catch (erro) {
        console.error("Erro ao carregar grupos:", erro);

        if (lista) {
            lista.textContent =
                "Não foi possível carregar os grupos. Verifica as permissões do Supabase.";
        }
    }
}

// =====================================================
// REGISTAR RELATÓRIO
// A estrutura da tabela será ligada depois de confirmar
// os nomes exactos das colunas.
// =====================================================

async function guardarRelatorio() {
    mensagem(
        "mensagem-relatorio",
        "O formulário está preparado. Falta ligar os campos à estrutura exacta das tabelas de relatórios.",
        true
    );
}

// =====================================================
// REGISTAR MEMBRO
// =====================================================

async function guardarMembro() {
    mensagem(
        "mensagem-membro",
        "O formulário está preparado. Falta confirmar a tabela e as colunas dos membros.",
        true
    );
}

// =====================================================
// REGISTAR CONTRIBUIÇÃO
// =====================================================

async function guardarContribuicao() {
    mensagem(
        "mensagem-contribuicao",
        "O formulário está preparado. Falta confirmar a tabela e as colunas das contribuições.",
        true
    );
}

// =====================================================
// ALTERAR COR PRINCIPAL
// =====================================================

function alterarCor() {
    const campo = elemento("cor-principal");
    if (!campo) return;

    const cor = campo.value;

    document.documentElement.style.setProperty(
        "--cor-principal",
        cor
    );

    localStorage.setItem("corPrincipal", cor);
}

function carregarCor() {
    const corGuardada = localStorage.getItem("corPrincipal");

    if (corGuardada) {
        document.documentElement.style.setProperty(
            "--cor-principal",
            corGuardada
        );

        if (elemento("cor-principal")) {
            elemento("cor-principal").value = corGuardada;
        }
    }
}

// =====================================================
// FOTO DE PERFIL
// =====================================================

function alterarFoto() {
    const ficheiro = elemento("ficheiro-foto");

    if (!ficheiro || !ficheiro.files || !ficheiro.files[0]) {
        alert("Escolhe primeiro uma fotografia.");
        return;
    }

    const imagem = ficheiro.files[0];

    if (!imagem.type.startsWith("image/")) {
        alert("Selecciona um ficheiro de imagem.");
        return;
    }

    if (imagem.size > 5 * 1024 * 1024) {
        alert("A fotografia deve ter no máximo 5 MB.");
        return;
    }

    const leitor = new FileReader();

    leitor.onload = function () {
        const foto = elemento("foto-perfil");

        if (foto) {
            foto.src = leitor.result;
        }
    };

    leitor.readAsDataURL(imagem);
}

// =====================================================
// TERMINAR SESSÃO
// =====================================================

async function sair() {
    if (!supabaseClient) return;

    const confirmar = window.confirm(
        "Tens a certeza de que pretendes terminar a sessão?"
    );

    if (!confirmar) return;

    try {
        const { error } = await supabaseClient.auth.signOut();

        if (error) throw error;

        utilizadorActual = null;
        window.location.reload();

    } catch (erro) {
        console.error(erro);
        alert("Não foi possível terminar a sessão.");
    }
}

// =====================================================
// INICIAR
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {
    carregarCor();
    await verificarSessao();

    if (supabaseClient) {
        supabaseClient.auth.onAuthStateChange(
            (_evento, session) => {
                utilizadorActual = session?.user || null;
            }
        );
  
/* =====================================================
   MÓDULO DE MEMBROS — R-MALOWA SENA 2.0
   ===================================================== */

async function listarMembros() {
    const area = document.getElementById("lista-membros");
    if (!area) return;

    area.textContent = "A carregar membros...";

    try {
        const { data, error } = await supabaseClient
            .from("members")
            .select("*")
            .order("name", { ascending: true });

        if (error) throw error;

        area.replaceChildren();

        if (!data || data.length === 0) {
            area.textContent = "Ainda não existem membros registados.";
            return;
        }

        data.forEach(membro => {
            const linha = document.createElement("div");
            linha.className = "grupo-item";
            linha.textContent =
                `${membro.name || "Sem nome"} — ${membro.category || "Categoria não definida"}`;
            area.appendChild(linha);
        });

    } catch (erro) {
        console.error(erro);
        area.textContent = "Erro ao carregar membros: " + erro.message;
    }
}

async function pesquisarMembros() {
    const pesquisa = document.getElementById("pesquisa-membro");
    const area = document.getElementById("lista-membros");

    if (!pesquisa || !area) return;

    const termo = pesquisa.value.trim();

    try {
        let consulta = supabaseClient
            .from("members")
            .select("*")
            .order("name", { ascending: true });

        if (termo) {
            consulta = consulta.ilike("name", `%${termo}%`);
        }

        const { data, error } = await consulta;

        if (error) throw error;

        area.replaceChildren();

        (data || []).forEach(membro => {
            const linha = document.createElement("div");
            linha.className = "grupo-item";
            linha.textContent = membro.name || "Sem nome";
            area.appendChild(linha);
        });

        if (!data || data.length === 0) {
            area.textContent = "Nenhum membro encontrado.";
        }

    } catch (erro) {
        console.error(erro);
        area.textContent = "Não foi possível pesquisar os membros.";
    }
}
  }
});
