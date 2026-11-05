// =====================================================
// R-MALOWA SENA 2.0
// MÓDULO DE RELATÓRIOS DE CAMPO
// =====================================================

let acessoPermitido = false;
let membrosAtuais = [];
let atividadesAtuais = [];
let estudosAtuais = [];

const T_GRUPOS = 'field_groups';
const T_RELATORIOS = 'field_reports';
const T_ATIVIDADES = 'field_activities';
const T_ESTUDOS = 'studies';

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function el(id) {
  return document.getElementById(id);
}

function valor(id, padrao = '') {
  return el(id)?.value ?? padrao;
}

function calcularDuracao(saida, regresso) {
  if (!saida || !regresso) return 0;

  const [h1, m1] = saida.split(':').map(Number);
  const [h2, m2] = regresso.split(':').map(Number);

  let minutos = (h2 * 60 + m2) - (h1 * 60 + m1);

  if (minutos < 0) minutos += 1440;

  return Number((minutos / 60).toFixed(2));
}

function obterPeriodo() {
  const mes = Number(valor('rel-mes', new Date().getMonth() + 1));
  const ano = Number(valor('rel-ano', new Date().getFullYear()));

  return {
    mes,
    ano,
    data: `${ano}-${String(mes).padStart(2, '0')}-01`
  };
}

function categoriaValida(categoria) {
  const c = String(categoria || '').toLowerCase();

  if (['regular', 'regular', 'pioneiro regular'].includes(c))
    return 'regular';

  if (['auxiliary', 'auxiliar', 'pioneiro auxiliar'].includes(c))
    return 'auxiliary';

  if (['publisher', 'publicador'].includes(c))
    return 'publisher';

  return '';
}

// =====================================================
// ACESSO À PASTA PRIVADA
// =====================================================

async function verificarAcessoPrivado() {
  const senha = valor('private-password');
  const aviso = el('access-message');
  const conteudo = el('relatorio-conteudo');

  if (!senha) {
    if (aviso) {
      aviso.textContent = 'Introduza a senha!';
      aviso.style.display = 'block';
    }
    return;
  }

  try {
    const { data, error } = await SB
      .from('private_settings')
      .select('password_hash')
      .single();

    if (error) throw error;

    if (senha !== data.password_hash) {
      await registarAcesso(false);

      if (aviso) {
        aviso.textContent = 'Senha incorreta!';
        aviso.style.display = 'block';
      }
      return;
    }

    await registarAcesso(true);

    acessoPermitido = true;

    if (aviso) aviso.style.display = 'none';
    if (conteudo) conteudo.style.display = 'block';

    await carregarGrupos();

  } catch (erro) {
    console.error(erro);

    if (aviso) {
      aviso.textContent = 'Erro: ' + erro.message;
      aviso.style.display = 'block';
    }
  }
}

async function registarAcesso(sucesso) {
  try {
    const { data } = await SB.auth.getSession();

    await SB.from('access_logs').insert({
      email: data?.session?.user?.email || 'desconhecido',
      success: sucesso
    });
  } catch (erro) {
    console.error('Erro no registo de acesso:', erro);
  }
}

// =====================================================
// GESTÃO DOS GRUPOS
// =====================================================

async function carregarGrupos() {
  const select = el('sel-grupo');
  if (!select) return;

  try {
    const { data, error } = await SB
      .from(T_GRUPOS)
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;

    select.innerHTML =
      '<option value="">-- Selecione um grupo --</option>';

    (data || []).forEach(grupo => {
      const opcao = document.createElement('option');
      opcao.value = grupo.id;
      opcao.textContent = grupo.name;
      select.appendChild(opcao);
    });

  } catch (erro) {
    console.error(erro);
    alert('Erro ao carregar grupos: ' + erro.message);
  }
}

async function adicionarGrupo() {
  if (!acessoPermitido) return alert('Acesso não autorizado.');

  const nome = prompt('Nome do novo grupo:');
  if (!nome?.trim()) return;

  try {
    const { error } = await SB
      .from(T_GRUPOS)
      .insert({
        name: nome.trim(),
        is_active: true
      });

    if (error) throw error;

    alert('Grupo adicionado!');
    await carregarGrupos();

  } catch (erro) {
    alert('Erro: ' + erro.message);
  }
}

async function editarGrupo() {
  if (!acessoPermitido) return alert('Acesso não autorizado.');

  const id = valor('sel-grupo');
  if (!id) return alert('Selecione um grupo.');

  const nome = prompt('Novo nome do grupo:');
  if (!nome?.trim()) return;

  try {
    const { error } = await SB
      .from(T_GRUPOS)
      .update({ name: nome.trim() })
      .eq('id', id);

    if (error) throw error;

    alert('Nome atualizado!');
    await carregarGrupos();

  } catch (erro) {
    alert('Erro: ' + erro.message);
  }
}

async function desativarGrupo() {
  if (!acessoPermitido) return alert('Acesso não autorizado.');

  const id = valor('sel-grupo');
  if (!id) return alert('Selecione um grupo.');

  if (!confirm('Deseja desativar este grupo?')) return;

  try {
    const { error } = await SB
      .from(T_GRUPOS)
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;

    alert('Grupo desativado. Os dados serão preservados.');
    limparTabelas();
    await carregarGrupos();

  } catch (erro) {
    alert('Erro: ' + erro.message);
  }
}

// =====================================================
// CONSULTAR MEMBROS
// =====================================================

async function consultarMembros(grupoId) {
  let resultado = await SB
    .from('members')
    .select('*')
    .eq('group_id', grupoId)
    .order('name');

  if (resultado.error) {
    resultado = await SB
      .from('member')
      .select('*')
      .eq('group_id', grupoId)
      .order('name');
  }

  if (resultado.error) throw resultado.error;

  return resultado.data || [];
}

// =====================================================
// CARREGAR RELATÓRIOS
// =====================================================

async function carregarRelatorio() {
  if (!acessoPermitido) return;

  const grupoId = valor('sel-grupo');

  if (!grupoId) {
    limparTabelas();
    return;
  }

  try {
    const periodo = obterPeriodo();

    const { data: relatorios, error } = await SB
      .from(T_RELATORIOS)
      .select('id, category')
      .eq('group_id', grupoId)
      .eq('report_month', periodo.data);

    if (error) throw error;

    const ids = (relatorios || []).map(r => r.id);

    membrosAtuais = await consultarMembros(grupoId);

    let atividades = [];
    let estudos = [];

    if (ids.length > 0) {
      const { data: a, error: ea } = await SB
        .from(T_ATIVIDADES)
        .select('*')
        .in('report_id', ids);

      if (ea) throw ea;

      const { data: e, error: ee } = await SB
        .from(T_ESTUDOS)
        .select('*')
        .in('report_id', ids);

      if (ee) throw ee;

      atividades = a || [];
      estudos = e || [];
    }

    atividadesAtuais = atividades;
    estudosAtuais = estudos;

    organizarEDesempenhar(
      membrosAtuais,
      atividadesAtuais,
      estudosAtuais
    );

    preencherListaMembros(membrosAtuais);

  } catch (erro) {
    console.error(erro);
    alert('Erro ao carregar relatório: ' + erro.message);
  }
}

// =====================================================
// ORGANIZAR CATEGORIAS
// =====================================================

function organizarEDesempenhar(membros, atividades, estudos) {
  const categorias = [
    {
      categoria: 'regular',
      tabela: 'tbl-regulares',
      prefixo: 'sub-reg'
    },
    {
      categoria: 'auxiliary',
      tabela: 'tbl-auxiliares',
      prefixo: 'sub-aux'
    },
    {
      categoria: 'publisher',
      tabela: 'tbl-publicadores',
      prefixo: 'sub-pub'
    }
  ];

  categorias.forEach(item => {
    const lista = membros.filter(
      m => categoriaValida(m.category) === item.categoria
    );

    exibirTabela(
      item.tabela,
      lista,
      atividades,
      estudos,
      item.prefixo
    );
  });

  const totalHoras = atividades.reduce(
    (s, a) => s + Number(a.hours || 0), 0
  );

  const totalEstudos = estudos.reduce(
    (s, e) => s + Number(e.study_count || 0), 0
  );

  const totalSaidas = new Set(
    atividades.map(a => a.member_id)
  ).size;

  if (el('total-horas'))
    el('total-horas').textContent = totalHoras.toFixed(2);

  if (el('total-estudos'))
    el('total-estudos').textContent = totalEstudos;

  if (el('total-saidas'))
    el('total-saidas').textContent = totalSaidas;
}

// =====================================================
// TABELAS DE PARTICIPAÇÃO
// =====================================================

function exibirTabela(tabelaId, lista, atividades, estudos, prefixo) {
  const corpo = el(tabelaId);
  if (!corpo) return;

  corpo.innerHTML = '';

  let totalHoras = 0;
  let totalEstudos = 0;

  if (!lista.length) {
    corpo.innerHTML =
      '<tr><td colspan="4">Sem membros nesta categoria.</td></tr>';
  }

  lista.forEach(membro => {
    const atv = atividades.filter(
      a => a.member_id === membro.id
    );

    const est = estudos.filter(
      e => e.member_id === membro.id
    );

    const horas = atv.reduce(
      (s, a) => s + Number(a.hours || 0), 0
    );

    const qtdEstudos = est.reduce(
      (s, e) => s + Number(e.study_count || 0), 0
    );

    totalHoras += horas;
    totalEstudos += qtdEstudos;

    const linha = document.createElement('tr');

    [
      membro.name,
      qtdEstudos,
      horas.toFixed(2),
      atv.length > 0 ? 'Sim' : 'Não'
    ].forEach(texto => {
      const td = document.createElement('td');
      td.textContent = String(texto);
      linha.appendChild(td);
    });

    corpo.appendChild(linha);
  });

  const campos = {
    estudos: `${prefixo}-estudos`,
    horas: `${prefixo}-horas`,
    total: `${prefixo}-total`
  };

  if (el(campos.estudos))
    el(campos.estudos).textContent = totalEstudos;

  if (el(campos.horas))
    el(campos.horas).textContent = totalHoras.toFixed(2);

  if (el(campos.total))
    el(campos.total).textContent = totalHoras.toFixed(2);
}

// =====================================================
// LISTA DE MEMBROS
// =====================================================

function preencherListaMembros(membros) {
  const select = el('act-membro');
  if (!select) return;

  select.innerHTML =
    '<option value="">-- Selecione uma pessoa --</option>';

  membros.forEach(m => {
    const opcao = document.createElement('option');
    opcao.value = m.id;
    opcao.textContent = m.name;
    select.appendChild(opcao);
  });
}

// =====================================================
// OBTER OU CRIAR RELATÓRIO
// =====================================================

async function obterRelatorio(grupoId, categoria, dataMes) {
  const { data, error } = await SB
    .from(T_RELATORIOS)
    .select('id')
    .eq('group_id', grupoId)
    .eq('report_month', dataMes)
    .eq('category', categoria)
    .maybeSingle();

  if (error) throw error;

  if (data) return data.id;

  const { data: novo, error: erroNovo } = await SB
    .from(T_RELATORIOS)
    .insert({
      group_id: grupoId,
      report_month: dataMes,
      category: categoria,
      hours: 0,
      studies: 0
    })
    .select('id')
    .single();

  if (erroNovo) throw erroNovo;

  return novo.id;
}

// =====================================================
// GUARDAR ATIVIDADE
// =====================================================

async function guardarAtividade() {
  if (!acessoPermitido)
    return alert('Acesso não autorizado.');

  const membroId = valor('act-membro');
  const data = valor('act-data');
  const saida = valor('act-saida');
  const regresso = valor('act-regresso');
  const qtdEstudos = Number(valor('act-estudos', 0));
  const grupoId = valor('sel-grupo');

  if (!membroId || !data || !saida || !regresso) {
    return alert('Preencha todos os campos obrigatórios.');
  }

  if (!Number.isInteger(qtdEstudos) || qtdEstudos < 0) {
    return alert('Número de estudos inválido.');
  }

  const horas = calcularDuracao(saida, regresso);

  if (horas <= 0) {
    return alert('Verifique as horas de saída e regresso.');
  }

  const membro = membrosAtuais.find(m => m.id === membroId);

  if (!membro) return alert('Membro não encontrado.');

  const categoria = categoriaValida(membro.category);

  if (!categoria) return alert('Categoria inválida.');

  try {
    const periodo = obterPeriodo();

    if (
      data.slice(0, 7) !==
      `${periodo.ano}-${String(periodo.mes).padStart(2, '0')}`
    ) {
      return alert('A data deve pertencer ao mês selecionado.');
    }

    const relatorioId = await obterRelatorio(
      grupoId,
      categoria,
      periodo.data
    );

    const { error } = await SB
      .from(T_ATIVIDADES)
      .insert({
        report_id: relatorioId,
        member_id: membroId,
        activity_date: data,
        time_out: saida,
        time_in: regresso,
        hours: horas
      });

    if (error) throw error;

    if (qtdEstudos > 0) {
      const { data: existente, error: buscaError } = await SB
        .from(T_ESTUDOS)
        .select('id, study_count')
        .eq('report_id', relatorioId)
        .eq('member_id', membroId)
        .maybeSingle();

      if (buscaError) throw buscaError;

      if (existente) {
        const { error: updateError } = await SB
          .from(T_ESTUDOS)
          .update({
            study_count:
              Number(existente.study_count || 0) + qtdEstudos
          })
          .eq('id', existente.id);

        if (updateError) throw updateError;

      } else {
        const { error: insertError } = await SB
          .from(T_ESTUDOS)
          .insert({
            report_id: relatorioId,
            member_id: membroId,
            study_count: qtdEstudos
          });

        if (insertError) throw insertError;
      }
    }

    alert('Registo guardado com sucesso!');

    [
      'act-membro',
      'act-data',
      'act-saida',
      'act-regresso'
    ].forEach(id => {
      if (el(id)) el(id).value = '';
    });

    if (el('act-estudos')) el('act-estudos').value = '0';
    if (el('act-horas')) el('act-horas').value = '';

    await carregarRelatorio();

  } catch (erro) {
    console.error(erro);
    alert('Erro ao guardar: ' + erro.message);
  }
}

// =====================================================
// CÁLCULO AUTOMÁTICO DE HORAS
// =====================================================

function calcularHorasFormulario() {
  const saida = valor('act-saida');
  const regresso = valor('act-regresso');
  const campo = el('act-horas');

  if (!campo) return;

  if (!saida || !regresso) {
    campo.value = '';
    return;
  }

  campo.value = calcularDuracao(saida, regresso).toFixed(2) + 'h';
}

// =====================================================
// LIMPAR TABELAS
// =====================================================

function limparTabelas() {
  [
    'tbl-regulares',
    'tbl-auxiliares',
    'tbl-publicadores'
  ].forEach(id => {
    if (el(id)) {
      el(id).innerHTML =
        '<tr><td colspan="4">Selecione um grupo...</td></tr>';
    }
  });

  [
    'sub-reg',
    'sub-aux',
    'sub-pub'
  ].forEach(prefixo => {
    ['estudos', 'horas', 'total'].forEach(tipo => {
      if (el(`${prefixo}-${tipo}`))
        el(`${prefixo}-${tipo}`).textContent = '0';
    });
  });

  ['total-estudos', 'total-horas', 'total-saidas'].forEach(id => {
    if (el(id)) el(id).textContent = '0';
  });
}

// =====================================================
// EVENTOS
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('R-MALOWA SENA 2.0 carregado.');

  ['act-saida', 'act-regresso'].forEach(id => {
    el(id)?.addEventListener('change', calcularHorasFormulario);
  });

  ['sel-grupo', 'rel-mes', 'rel-ano'].forEach(id => {
    el(id)?.addEventListener('change', carregarRelatorio);
  });
});
