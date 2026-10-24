
document.addEventListener("DOMContentLoaded", iniciarAdministracion);

async function iniciarAdministracion() {
  const db = window.supabaseCliente;

  if (!db) {
    mostrarEstado("estadoCarga", "No se pudo iniciar la conexión con Supabase.", "error");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const tablas = {
    miembros: [],
    organizaciones: [],
    organizacionesMiembros: [],
    estudiosMiembros: [],
    vinculos: []
  };

  let resultadosActuales = [];
  let miembroEnEdicion = null;
  let vinculoEnEdicion = null;

  function mostrarEstado(id, mensaje, tipo = "") {
    const elemento = $(id);
    if (!elemento) return;
    elemento.className = "estado" + (tipo ? " " + tipo : "");
    elemento.textContent = mensaje || "";
  }

  function mostrarCarga(id, mensaje) {
    const elemento = $(id);
    if (!elemento) return;
    elemento.className = "estado";
    elemento.innerHTML = '<span class="cargando"><span class="rueda"></span><span></span></span>';
    elemento.querySelector(".cargando span:last-child").textContent = mensaje;
  }

  function normalizar(valor) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function texto(valor) {
    return valor == null ? "" : String(valor);
  }

  function escapar(valor) {
    return texto(valor).replace(/[&<>"']/g, (caracter) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[caracter]);
  }

  function fechaBonita(fecha) {
    if (!fecha) return "";
    const partes = String(fecha).slice(0, 10).split("-");
    return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha;
  }

  function calcularEdad(fecha) {
    if (!fecha) return "";
    const nacimiento = new Date(fecha + "T12:00:00");
    if (Number.isNaN(nacimiento.getTime())) return "";
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const diferenciaMes = hoy.getMonth() - nacimiento.getMonth();
    if (diferenciaMes < 0 ||
        (diferenciaMes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad >= 0 ? edad : "";
  }

  function nombreCompleto(miembro) {
    return `${texto(miembro.nombres)} ${texto(miembro.apellidos)}`.trim();
  }

  function coincideTexto(valor, filtro) {
    return !filtro || normalizar(valor).includes(normalizar(filtro));
  }
  
function obtenerUrlFotoAdministracion(url) {
  if (!url) return "";

  try {
    const enlace = new URL(url);

    if (enlace.protocol !== "https:" && enlace.protocol !== "http:") {
      return "";
    }

    if (enlace.hostname === "drive.google.com") {
      const coincidencia = enlace.pathname.match(/\/file\/d\/([^/]+)/);
      const id = coincidencia
        ? coincidencia[1]
        : enlace.searchParams.get("id");

      if (id) {
        return "https://drive.google.com/thumbnail?id=" +
          encodeURIComponent(id) + "&sz=w1000";
      }
    }

    return enlace.href;
  } catch {
    return "";
  }
}

  function valor(id) {
    return $(id)?.value?.trim() ?? "";
  }

  function asignar(id, dato) {
    const elemento = $(id);
    if (elemento) elemento.value = dato == null ? "" : String(dato);
  }

  async function cargarTabla(nombre) {
    const todos = [];
    const tamano = 1000;
    let desde = 0;

    while (true) {
      const { data, error } = await db
        .from(nombre)
        .select("*")
        .range(desde, desde + tamano - 1);

      if (error) throw new Error(`No se pudo consultar ${nombre}: ${error.message}`);
      todos.push(...(data || []));
      if (!data || data.length < tamano) break;
      desde += tamano;
    }
    return todos;
  }

  function esEstudio(organizacion) {
    return normalizar(organizacion.tipo) === "estudio_biblico";
  }

  function esMinisterio(organizacion) {
    return normalizar(organizacion.tipo) === "ministerio";
  }

  function buscarOrganizacionPorValor(seleccion, tipo) {
    const buscado = normalizar(seleccion);
    const candidatas = tablas.organizaciones.filter((o) =>
      normalizar(o.tipo) === normalizar(tipo)
    );

    if (buscado === "efom") {
      return candidatas.find((o) => normalizar(o.nombre).includes("efom")) || null;
    }
    if (buscado === "instituto biblico") {
      return candidatas.find((o) => normalizar(o.nombre).includes("instituto biblico")) || null;
    }
    if (buscado === "cmf") {
      return candidatas.find((o) => normalizar(o.nombre).includes("cmf")) || null;
    }

    return candidatas.find((o) => normalizar(o.nombre) === buscado) || null;
  }

  function obtenerOrganizacionesDeMiembro(id) {
    const relaciones = tablas.organizacionesMiembros.filter((r) =>
      r.miembro_id === id && r.activa !== false && !r.fecha_fin
    );
    return relaciones
      .map((r) => tablas.organizaciones.find((o) => o.id === r.organizacion_id))
      .filter(Boolean);
  }

  function obtenerEstudiosDeMiembro(id) {
    const relaciones = tablas.estudiosMiembros.filter((r) =>
      r.miembro_id === id && r.activa !== false
    );
    return relaciones
      .map((r) => tablas.organizaciones.find((o) => o.id === r.organizacion_id))
      .filter(Boolean);
  }

  function obtenerVinculosDeMenor(id) {
    return tablas.vinculos.filter((v) => v.miembro_menor_id === id);
  }

  function obtenerAdultosVinculados(id) {
    return tablas.vinculos.filter((v) => v.adulto_miembro_id === id);
  }

  async function recargarDatos(mostrarMensaje = true) {
    if (mostrarMensaje) mostrarCarga("estadoCarga", "Cargando registros y relaciones…");
    $("botonCargar").disabled = true;

    try {
      const [miembros, organizaciones, relaciones, estudios, vinculos] = await Promise.all([
        cargarTabla("miembros"),
        cargarTabla("organizaciones"),
        cargarTabla("miembros_organizaciones"),
        cargarTabla("miembros_estudios_biblicos"),
        cargarTabla("vinculos_familiares")
      ]);

      tablas.miembros = miembros;
      tablas.organizaciones = organizaciones;
      tablas.organizacionesMiembros = relaciones;
      tablas.estudiosMiembros = estudios;
      tablas.vinculos = vinculos;

      llenarFiltrosDeOrganizaciones();
      llenarOpcionesDeEdicion();
      aplicarFiltros(false);

      mostrarEstado("estadoCarga", `Datos actualizados: ${miembros.length} miembros cargados.`, "exito");
    } catch (error) {
      console.error(error);
      mostrarEstado("estadoCarga", error.message || "Ocurrió un error al cargar los registros.", "error");
    } finally {
      $("botonCargar").disabled = false;
    }
  }

  function llenarSelect(id, organizaciones, textoInicial) {
    const select = $(id);
    if (!select) return;
    const anterior = select.value;
    select.replaceChildren(new Option(textoInicial, ""));

    organizaciones
      .filter((o) => o.activa !== false)
      .sort((a, b) => texto(a.nombre).localeCompare(texto(b.nombre), "es"))
      .forEach((o) => select.add(new Option(o.nombre, o.id)));

    if ([...select.options].some((opcion) => opcion.value === anterior)) {
      select.value = anterior;
    }
  }

  function llenarFiltrosDeOrganizaciones() {
    llenarSelect(
      "filtroOrganizacion",
      tablas.organizaciones.filter(esMinisterio),
      "Todas las organizaciones"
    );
    llenarSelect(
      "filtroEstudioBiblico",
      tablas.organizaciones.filter(esEstudio),
      "Todos los estudios"
    );
  }

  function crearOpcionesMarcables(contenedorId, organizaciones, prefijo) {
    const contenedor = $(contenedorId);
    contenedor.replaceChildren();

    organizaciones
      .filter((o) => o.activa !== false)
      .sort((a, b) => texto(a.nombre).localeCompare(texto(b.nombre), "es"))
      .forEach((o) => {
        const etiqueta = document.createElement("label");
        etiqueta.className = "opcion";

        const casilla = document.createElement("input");
        casilla.type = "checkbox";
        casilla.name = prefijo;
        casilla.value = o.id;

        const nombre = document.createElement("span");
        nombre.textContent = o.nombre;

        etiqueta.append(casilla, nombre);
        contenedor.appendChild(etiqueta);
      });
  }

  function llenarOpcionesDeEdicion() {
    crearOpcionesMarcables(
      "edicionOrganizaciones",
      tablas.organizaciones.filter(esMinisterio),
      "edicionOrganizacion"
    );
    crearOpcionesMarcables(
      "edicionEstudios",
      tablas.organizaciones.filter(esEstudio),
      "edicionEstudio"
    );

    const select = $("edicionAdultoMiembro");
    const anterior = select.value;
    select.replaceChildren(new Option("No seleccionado", ""));
    tablas.miembros
      .filter((m) => !miembroEnEdicion || m.id !== miembroEnEdicion.id)
      .filter((m) => {
        const edad = calcularEdad(m.fecha_nacimiento);
        return edad !== "" && edad >= 18;
      })
      .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b), "es"))
      .forEach((m) => {
        select.add(new Option(
          `${m.codigo_miembro ?? "Sin código"} — ${nombreCompleto(m)}`,
          m.id
        ));
      });

    if ([...select.options].some((opcion) => opcion.value === anterior)) {
      select.value = anterior;
    }
  }

  function miembroPasaFiltros(m) {
    const busqueda = normalizar(valor("busquedaGeneral"));
    const fecha = texto(m.fecha_nacimiento).slice(0, 10);
    const edad = calcularEdad(m.fecha_nacimiento);
    const filtroEdadMin = valor("filtroEdadMinima");
    const filtroEdadMax = valor("filtroEdadMaxima");

    if (busqueda && ![
      m.codigo_miembro, m.nombres, m.apellidos
    ].some((dato) => normalizar(dato).includes(busqueda))) return false;

    if (valor("filtroCodigo") && String(m.codigo_miembro) !== valor("filtroCodigo")) return false;
    if (!coincideTexto(m.nombres, valor("filtroNombres"))) return false;
    if (!coincideTexto(m.apellidos, valor("filtroApellidos"))) return false;
    if (filtroEdadMin !== "" && (edad === "" || edad < Number(filtroEdadMin))) return false;
    if (filtroEdadMax !== "" && (edad === "" || edad > Number(filtroEdadMax))) return false;
    if (valor("filtroFechaDesde") && (!fecha || fecha < valor("filtroFechaDesde"))) return false;
    if (valor("filtroFechaHasta") && (!fecha || fecha > valor("filtroFechaHasta"))) return false;
    if (valor("filtroEstadoCivil") && normalizar(m.estado_civil) !== normalizar(valor("filtroEstadoCivil"))) return false;
    if (!coincideTexto(m.lugar_nacimiento, valor("filtroLugarNacimiento"))) return false;
    if (!coincideTexto(m.profesion_ocupacion, valor("filtroProfesion"))) return false;
    if (!coincideTexto(m.nivel_academico, valor("filtroNivelAcademico"))) return false;
    if (valor("filtroNumeroHijos") !== "" &&
        Number(m.numero_hijos ?? 0) !== Number(valor("filtroNumeroHijos"))) return false;
    if (valor("filtroTelefono") && !normalizar(m.telefono_principal).includes(normalizar(valor("filtroTelefono")))) return false;
    if (valor("filtroTelefonoAlternativo") &&
        !normalizar(m.telefono_alternativo).includes(normalizar(valor("filtroTelefonoAlternativo")))) return false;
    if (valor("filtroBautismoAgua") &&
        normalizar(m.bautismo_agua) !== normalizar(valor("filtroBautismoAgua"))) return false;
    if (!coincideTexto(m.lugar_bautismo, valor("filtroLugarBautismo"))) return false;
    if (valor("filtroBautismoEspiritu") &&
        normalizar(m.bautismo_espiritu_santo) !== normalizar(valor("filtroBautismoEspiritu"))) return false;

    const organizacionId = valor("filtroOrganizacion");
    if (organizacionId && !obtenerOrganizacionesDeMiembro(m.id).some((o) => o.id === organizacionId)) return false;

    const estudioId = valor("filtroEstudioBiblico");
    if (estudioId && !obtenerEstudiosDeMiembro(m.id).some((o) => o.id === estudioId)) return false;

    const estadoVinculo = valor("filtroVinculoFamiliar");
    const parentesco = valor("filtroParentesco");
    if (estadoVinculo || parentesco) {
      const vinculos = obtenerVinculosDeMenor(m.id);
      if (estadoVinculo && !vinculos.some((v) => normalizar(v.estado_vinculo) === normalizar(estadoVinculo))) return false;
      if (parentesco && !vinculos.some((v) => normalizar(v.parentesco) === normalizar(parentesco))) return false;
    }

    return true;
  }

  function aplicarFiltros(mostrarIndicador = true) {
    if (mostrarIndicador) mostrarCarga("estadoFiltros", "Aplicando filtros…");
    $("botonAplicarFiltros").disabled = true;

    // Permite que el navegador pinte el indicador antes de procesar los filtros.
    window.setTimeout(() => {
      resultadosActuales = tablas.miembros.filter(miembroPasaFiltros);
      pintarTabla(resultadosActuales);

      mostrarEstado(
        "estadoFiltros",
        `Consulta terminada: ${resultadosActuales.length} resultado(s) de ${tablas.miembros.length} miembro(s).`,
        "exito"
      );
      $("botonAplicarFiltros").disabled = false;
    }, mostrarIndicador ? 40 : 0);
  }

  function pintarTabla(miembros) {
    const cuerpo = $("listaMiembros");
    cuerpo.replaceChildren();

    if (!miembros.length) {
      const fila = cuerpo.insertRow();
      const celda = fila.insertCell();
      celda.colSpan = 7;
      celda.textContent = "No hay registros que coincidan con la consulta.";
      $("contadorMiembros").textContent = "0 registros";
      return;
    }

    miembros.forEach((m) => {
      const fila = cuerpo.insertRow();
      [
        m.codigo_miembro ?? "",
        m.nombres ?? "",
        m.apellidos ?? "",
        fechaBonita(m.fecha_nacimiento),
        m.telefono_principal ?? "",
        m.estado_civil ?? ""
      ].forEach((dato) => {
        const celda = fila.insertCell();
        celda.textContent = dato;
      });

      const celdaAccion = fila.insertCell();
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "principal boton-tabla";
      boton.textContent = "Editar";
      boton.addEventListener("click", () => abrirEdicion(m.id));
      celdaAccion.appendChild(boton);
    });

    $("contadorMiembros").textContent = `${miembros.length} registro(s)`;
  }

  function marcarCasillas(contenedorId, idsSeleccionados) {
    const seleccionados = new Set(idsSeleccionados);
    $(contenedorId).querySelectorAll('input[type="checkbox"]').forEach((casilla) => {
      casilla.checked = seleccionados.has(casilla.value);
    });
  }

  function mostrarCamposBautismo() {
    const tieneBautismo = valor("edicionBautismoAgua") === "si";
    $("grupoEdicionLugarBautismo").classList.toggle("oculto", !tieneBautismo);
    if (!tieneBautismo) asignar("edicionLugarBautismo", "");
  }

  function abrirEdicion(id) {
    const m = tablas.miembros.find((miembro) => miembro.id === id);
    if (!m) return;

    miembroEnEdicion = m;
    vinculoEnEdicion = obtenerVinculosDeMenor(id)[0] || null;
    llenarOpcionesDeEdicion();

    asignar("edicionId", m.id);
    asignar("edicionCodigo", m.codigo_miembro);
    asignar("edicionCodigoVisible", `Código: ${m.codigo_miembro ?? "—"}`);
    $("edicionCodigoVisible").textContent = `Código: ${m.codigo_miembro ?? "—"}`;
    asignar("edicionNombres", m.nombres);
    asignar("edicionApellidos", m.apellidos);
    
asignar("edicionFotoUrl", m.foto_url);

const foto = $("edicionFoto");
const mensajeFoto = $("edicionFotoMensaje");

function actualizarVistaFoto() {
  const url = obtenerUrlFotoAdministracion(valor("edicionFotoUrl"));

  if (!url) {
    foto.style.display = "none";
    foto.removeAttribute("src");
    mensajeFoto.textContent = "Sin fotografía o enlace no válido.";
    return;
  }

  foto.onerror = () => {
    foto.style.display = "none";
    mensajeFoto.textContent = "No se pudo cargar la imagen. Revise el enlace.";
  };

  foto.onload = () => {
    mensajeFoto.textContent = "Vista previa disponible.";
  };

  foto.src = url;
  foto.style.display = "block";
}

$("edicionFotoUrl").oninput = actualizarVistaFoto;
actualizarVistaFoto();

    const foto = $("edicionFoto");
const mensajeFoto = $("edicionFotoMensaje");

if (foto && mensajeFoto) {
    foto.onerror = () => {
        foto.style.display = "none";
        mensajeFoto.textContent = "No se pudo cargar la fotografía.";
    };

    if (m.foto_url) {
        foto.src = m.foto_url;
        foto.style.display = "block";
        mensajeFoto.textContent = "";
    } else {
        foto.removeAttribute("src");
        foto.style.display = "none";
        mensajeFoto.textContent = "Sin fotografía registrada.";
    }
}
    asignar("edicionFecha", m.fecha_nacimiento);
    asignar("edicionEdad", calcularEdad(m.fecha_nacimiento));
    asignar("edicionEstadoCivil", m.estado_civil);
    asignar("edicionLugarNacimiento", m.lugar_nacimiento);
    asignar("edicionProfesion", m.profesion_ocupacion);
    asignar("edicionNivelAcademico", m.nivel_academico);
    asignar("edicionTelefono", m.telefono_principal);
    asignar("edicionTelefonoAlternativo", m.telefono_alternativo);
    asignar("edicionNumeroHijos", m.numero_hijos);
    asignar("edicionBautismoAgua", m.bautismo_agua);
    asignar("edicionLugarBautismo", m.lugar_bautismo);
    asignar("edicionBautismoEspiritu", m.bautismo_espiritu_santo);

    // Si la base contiene un valor histórico no incluido en las opciones, se conserva como opción.
    ["edicionEstadoCivil", "edicionNivelAcademico", "edicionBautismoAgua", "edicionBautismoEspiritu"].forEach((idCampo) => {
      const campo = $(idCampo);
      const dato = m[({
        edicionEstadoCivil: "estado_civil",
        edicionNivelAcademico: "nivel_academico",
        edicionBautismoAgua: "bautismo_agua",
        edicionBautismoEspiritu: "bautismo_espiritu_santo"
      })[idCampo]];
      if (dato && ![...campo.options].some((opcion) => opcion.value === dato)) {
        campo.add(new Option(`${dato} (valor existente)`, dato));
      }
    });

    const orgs = tablas.organizacionesMiembros
      .filter((r) => r.miembro_id === id && r.activa !== false && !r.fecha_fin)
      .map((r) => r.organizacion_id);
    const estudios = tablas.estudiosMiembros
      .filter((r) => r.miembro_id === id && r.activa !== false)
      .map((r) => r.organizacion_id);

    marcarCasillas("edicionOrganizaciones", orgs);
    marcarCasillas("edicionEstudios", estudios);

    const edad = calcularEdad(m.fecha_nacimiento);
    $("seccionResponsable").classList.toggle("oculto", edad === "" || edad >= 18);

    if (vinculoEnEdicion) {
      asignar("edicionEstadoVinculo", vinculoEnEdicion.estado_vinculo);
      asignar("edicionAdultoMiembro", vinculoEnEdicion.adulto_miembro_id);
      asignar("edicionNombresResponsable", vinculoEnEdicion.nombres_adulto_pendiente);
      asignar("edicionApellidosResponsable", vinculoEnEdicion.apellidos_adulto_pendiente);
      asignar("edicionTelefonoResponsable", vinculoEnEdicion.telefono_adulto_pendiente);
      asignar("edicionParentesco", vinculoEnEdicion.parentesco);
      asignar("edicionObservacionesVinculo", vinculoEnEdicion.observaciones);
    } else {
      asignar("edicionEstadoVinculo", "pendiente");
      asignar("edicionAdultoMiembro", "");
      asignar("edicionNombresResponsable", "");
      asignar("edicionApellidosResponsable", "");
      asignar("edicionTelefonoResponsable", "");
      asignar("edicionParentesco", "");
      asignar("edicionObservacionesVinculo", "");
    }

    mostrarCamposBautismo();
    mostrarEstado("estadoEdicion", "");
    $("panelEdicion").classList.remove("oculto");
    $("panelEdicion").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function sincronizarOrganizaciones(miembroId, idsSeleccionados) {
    const disponibles = new Set(
      tablas.organizaciones.filter(esMinisterio).map((o) => o.id)
    );
    const actuales = tablas.organizacionesMiembros.filter((r) =>
      r.miembro_id === miembroId && disponibles.has(r.organizacion_id)
    );
    const seleccionados = new Set(idsSeleccionados);
    const hoy = new Date().toISOString().slice(0, 10);

    for (const relacion of actuales) {
      const debeEstarActiva = seleccionados.has(relacion.organizacion_id);
      const activaAhora = relacion.activa !== false && !relacion.fecha_fin;

      if (debeEstarActiva && !activaAhora) {
        const { error } = await db.from("miembros_organizaciones")
          .update({ activa: true, fecha_fin: null })
          .eq("id", relacion.id);
        if (error) throw error;
      } else if (!debeEstarActiva && activaAhora) {
        const { error } = await db.from("miembros_organizaciones")
          .update({ activa: false, fecha_fin: hoy })
          .eq("id", relacion.id);
        if (error) throw error;
      }
    }

    for (const idOrg of seleccionados) {
      const existeActiva = actuales.some((r) =>
        r.organizacion_id === idOrg && r.activa !== false && !r.fecha_fin
      );
      if (!existeActiva) {
        const { error } = await db.from("miembros_organizaciones").insert({
          miembro_id: miembroId,
          organizacion_id: idOrg,
          fecha_inicio: hoy,
          fecha_fin: null,
          activa: true
        });
        if (error) throw error;
      }
    }
  }

  async function sincronizarEstudios(miembroId, idsSeleccionados) {
    const disponibles = new Set(
      tablas.organizaciones.filter(esEstudio).map((o) => o.id)
    );
    const actuales = tablas.estudiosMiembros.filter((r) =>
      r.miembro_id === miembroId && disponibles.has(r.organizacion_id)
    );
    const seleccionados = new Set(idsSeleccionados);
    const hoy = new Date().toISOString().slice(0, 10);

    for (const relacion of actuales) {
      const debeEstarActivo = seleccionados.has(relacion.organizacion_id);
      const estaActivo = relacion.activa !== false;

      if (debeEstarActivo !== estaActivo) {
        const { error } = await db.from("miembros_estudios_biblicos")
          .update({ activa: debeEstarActivo })
          .eq("id", relacion.id);
        if (error) throw error;
      }
    }

    for (const idOrg of seleccionados) {
      const existeActivo = actuales.some((r) =>
        r.organizacion_id === idOrg && r.activa !== false
      );
      if (!existeActivo) {
        const { error } = await db.from("miembros_estudios_biblicos").insert({
          miembro_id: miembroId,
          organizacion_id: idOrg,
          fecha_inicio: hoy,
          activa: true
        });
        if (error) throw error;
      }
    }
  }

  async function guardarVinculo(miembroId) {
    const edad = calcularEdad(valor("edicionFecha"));
    if (edad === "" || edad >= 18) return;

    const adultoId = valor("edicionAdultoMiembro");
    const estado = valor("edicionEstadoVinculo");
    const parentesco = valor("edicionParentesco");
    const nombres = valor("edicionNombresResponsable");
    const apellidos = valor("edicionApellidosResponsable");
    const telefono = valor("edicionTelefonoResponsable");
    const observaciones = valor("edicionObservacionesVinculo");

    const hayDatos = Boolean(adultoId || nombres || apellidos || telefono || parentesco || vinculoEnEdicion);
    if (!hayDatos) return;

    if (!parentesco) {
      throw new Error("Seleccione el parentesco del responsable del menor.");
    }
    if (estado === "confirmado" && !adultoId) {
      throw new Error("Para confirmar el vínculo, seleccione al adulto registrado.");
    }
    if (estado === "pendiente" && adultoId) {
      throw new Error("Para un vínculo pendiente, quite el adulto registrado o cambie el estado a confirmado.");
    }
    if (estado === "pendiente" && !nombres && !apellidos) {
      throw new Error("Para dejar el vínculo pendiente, indique al menos el nombre o los apellidos del responsable.");
    }

    const datos = {
      miembro_menor_id: miembroId,
      adulto_miembro_id: estado === "confirmado" ? adultoId : null,
      nombres_adulto_pendiente: estado === "pendiente" ? (nombres || null) : null,
      apellidos_adulto_pendiente: estado === "pendiente" ? (apellidos || null) : null,
      telefono_adulto_pendiente: estado === "pendiente" ? (telefono || null) : null,
      parentesco,
      estado_vinculo: estado,
      observaciones: observaciones || null
    };

    if (vinculoEnEdicion) {
      const { error } = await db.from("vinculos_familiares")
        .update(datos).eq("id", vinculoEnEdicion.id);
      if (error) throw error;
    } else {
      const { error } = await db.from("vinculos_familiares").insert(datos);
      if (error) throw error;
    }
  }

  async function guardarEdicion(evento) {
    evento.preventDefault();
    const boton = $("botonGuardarEdicion");
    const miembroId = valor("edicionId");
    if (!miembroId) return;

    boton.disabled = true;
    mostrarCarga("estadoEdicion", "Guardando los cambios…");

    try {
      const nacimiento = valor("edicionFecha");
      if (!nacimiento || nacimiento > new Date().toISOString().slice(0, 10)) {
        throw new Error("Verifique la fecha de nacimiento.");
      }

      const numeroHijosTexto = valor("edicionNumeroHijos");
      const datos = {
        nombres: valor("edicionNombres"),
        apellidos: valor("edicionApellidos"),
        foto_url: obtenerUrlFotoAdministracion(valor("edicionFotoUrl")) || null,
        fecha_nacimiento: nacimiento,
        telefono_principal: valor("edicionTelefono") || null,
        telefono_alternativo: valor("edicionTelefonoAlternativo") || null,
        estado_civil: valor("edicionEstadoCivil") || null,
        lugar_nacimiento: valor("edicionLugarNacimiento") || null,
        bautismo_agua: valor("edicionBautismoAgua") || null,
        lugar_bautismo: valor("edicionBautismoAgua") === "si"
          ? (valor("edicionLugarBautismo") || null) : null,
        bautismo_espiritu_santo: valor("edicionBautismoEspiritu") || null,
        profesion_ocupacion: valor("edicionProfesion") || null,
        nivel_academico: valor("edicionNivelAcademico") || null,
        numero_hijos: numeroHijosTexto === "" ? null : Number(numeroHijosTexto),
        actualizado_en: new Date().toISOString()
      };

      if (!datos.nombres || !datos.apellidos) {
        throw new Error("Los nombres y apellidos son obligatorios.");
      }
      if (datos.numero_hijos !== null &&
          (!Number.isInteger(datos.numero_hijos) || datos.numero_hijos < 0)) {
        throw new Error("El número de hijos debe ser un entero igual o mayor que cero.");
      }

      const { error: errorMiembro } = await db
        .from("miembros").update(datos).eq("id", miembroId);
      if (errorMiembro) throw errorMiembro;

      const orgsSeleccionadas = [...$("edicionOrganizaciones").querySelectorAll("input:checked")]
        .map((casilla) => casilla.value);
      const estudiosSeleccionados = [...$("edicionEstudios").querySelectorAll("input:checked")]
        .map((casilla) => casilla.value);

      await sincronizarOrganizaciones(miembroId, orgsSeleccionadas);
      await sincronizarEstudios(miembroId, estudiosSeleccionados);
      await guardarVinculo(miembroId);

      mostrarEstado("estadoEdicion", "Cambios guardados correctamente.", "exito");
      await recargarDatos(false);

      // Mantener el formulario abierto para que el usuario vea que guardó.
      const miembroActualizado = tablas.miembros.find((m) => m.id === miembroId);
      if (miembroActualizado) {
        miembroEnEdicion = miembroActualizado;
        abrirEdicion(miembroId);
        mostrarEstado("estadoEdicion", "Cambios guardados correctamente.", "exito");
      }
    } catch (error) {
      console.error(error);
      mostrarEstado(
        "estadoEdicion",
        `No se pudieron guardar todos los cambios: ${error.message || "error desconocido"}. Revise el registro antes de volver a guardar.`,
        "error"
      );
    } finally {
      boton.disabled = false;
    }
  }

  function limpiarFiltros() {
    [
      "busquedaGeneral", "filtroCodigo", "filtroNombres", "filtroApellidos",
      "filtroEdadMinima", "filtroEdadMaxima", "filtroFechaDesde", "filtroFechaHasta",
      "filtroEstadoCivil", "filtroLugarNacimiento", "filtroProfesion",
      "filtroNivelAcademico", "filtroNumeroHijos", "filtroTelefono",
      "filtroTelefonoAlternativo", "filtroBautismoAgua", "filtroLugarBautismo",
      "filtroBautismoEspiritu", "filtroOrganizacion", "filtroEstudioBiblico",
      "filtroVinculoFamiliar", "filtroParentesco"
    ].forEach((id) => asignar(id, ""));

    aplicarFiltros(true);
  }

  
async function generarPDF() {
  if (!resultadosActuales.length) {
    mostrarEstado(
      "estadoFiltros",
      "No hay resultados para generar el PDF.",
      "error"
    );
    return;
  }

  function cargarScriptPDF(url) {
    return new Promise((resolve, reject) => {
      const existente = document.querySelector(
        `script[src="${url}"]`
      );

      if (existente) {
        if (url.includes("jspdf.umd.min.js") && window.jspdf) {
          resolve();
          return;
        }

        if (
          url.includes("jspdf.plugin.autotable.min.js") &&
          window.jspdf?.jsPDF
        ) {
          const prueba = new window.jspdf.jsPDF();
          if (typeof prueba.autoTable === "function") {
            resolve();
            return;
          }
        }
      }

      const script = document.createElement("script");
      script.src = url;
      script.onload = resolve;
      script.onerror = () =>
        reject(new Error("No se pudo cargar la biblioteca para PDF."));

      document.head.appendChild(script);
    });
  }

  try {
    mostrarEstado(
      "estadoFiltros",
      "Preparando el PDF...",
      "exito"
    );

    await cargarScriptPDF(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
    );

    await cargarScriptPDF(
      "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js"
    );

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4"
    });

    let logoCargado = false;

    try {
     const respuesta = await fetch("logo-arca.jpg");

      if (!respuesta.ok) {
        throw new Error("No se encontró el logo.");
      }

      const archivoLogo = await respuesta.blob();

      const logoData = await new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = reject;
        lector.readAsDataURL(archivoLogo);
      });

      pdf.addImage(logoData, "JPEG", 14, 8, 20, 20);
      logoCargado = true;
    } catch (errorLogo) {
      console.warn("No se pudo cargar el logo:", errorLogo);
    }

    const inicioTitulo = logoCargado ? 39 : 14;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(17);
    pdf.setTextColor(23, 63, 53);
    pdf.text("Membresía Arca de Noé", inicioTitulo, 15);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);

    pdf.text(
      `Reporte de miembros | Registros: ${resultadosActuales.length}`,
      inicioTitulo,
      22
    );

    pdf.text(
      `Fecha: ${new Date().toLocaleDateString("es-GT")}`,
      inicioTitulo,
      27
    );

    const filas = resultadosActuales.map((m) => [
      m.codigo_miembro || "",
      m.nombres || "",
      m.apellidos || "",
      fechaBonita(m.fecha_nacimiento) || "",
      m.telefono_principal || "",
      m.estado_civil || "",
      m.lugar_nacimiento || "",
      m.profesion_ocupacion || "",
      obtenerOrganizacionesDeMiembro(m.id)
        .map((o) => o.nombre)
        .join(", "),
      obtenerEstudiosDeMiembro(m.id)
        .map((o) => o.nombre)
        .join(", ")
    ]);

    pdf.autoTable({
      startY: 33,
      head: [[
        "Código",
        "Nombres",
        "Apellidos",
        "Nacimiento",
        "Teléfono",
        "Estado civil",
        "Lugar nacimiento",
        "Ocupación",
        "Organizaciones",
        "Estudios bíblicos"
      ]],
      body: filas,
      theme: "grid",
      margin: { left: 10, right: 10 },
      styles: {
        font: "helvetica",
        fontSize: 7,
        cellPadding: 2,
        overflow: "linebreak",
        valign: "top"
      },
      headStyles: {
        fillColor: [23, 63, 53],
        textColor: [255, 255, 255],
        fontStyle: "bold"
      },
      alternateRowStyles: {
        fillColor: [242, 246, 243]
      },
      horizontalPageBreak: true,
      horizontalPageBreakRepeat: [0, 1, 2]
    });

    const fechaArchivo = new Date().toISOString().slice(0, 10);

    pdf.save(`reporte_membresia_${fechaArchivo}.pdf`);

    mostrarEstado(
      "estadoFiltros",
      logoCargado
        ? "PDF descargado correctamente con el logo."
        : "PDF descargado. No se pudo cargar el logo; revise la ruta del archivo.",
      logoCargado ? "exito" : "error"
    );

  } catch (error) {
    console.error("Error al generar el PDF:", error);

    mostrarEstado(
      "estadoFiltros",
      "No se pudo generar el PDF. Revise su conexión a internet e inténtelo de nuevo.",
      "error"
    );
  }
}


  // Eventos del panel
  $("botonCargar").addEventListener("click", () => recargarDatos(true));
  $("botonAplicarFiltros").addEventListener("click", () => aplicarFiltros(true));
  $("botonLimpiarFiltros").addEventListener("click", limpiarFiltros);
  $("botonGenerarPDF").addEventListener("click", generarPDF);
  $("formularioEdicion").addEventListener("submit", guardarEdicion);
  $("botonCancelarEdicion").addEventListener("click", () => {
    $("panelEdicion").classList.add("oculto");
    miembroEnEdicion = null;
    vinculoEnEdicion = null;
    mostrarEstado("estadoEdicion", "");
  });
  $("edicionBautismoAgua").addEventListener("change", mostrarCamposBautismo);
  $("edicionFecha").addEventListener("change", () => {
    asignar("edicionEdad", calcularEdad(valor("edicionFecha")));
    $("seccionResponsable").classList.toggle("oculto", !valor("edicionFecha") || calcularEdad(valor("edicionFecha")) >= 18);
  });
  $("edicionEstadoVinculo").addEventListener("change", () => {
    const confirmado = valor("edicionEstadoVinculo") === "confirmado";
    if (confirmado) {
      asignar("edicionNombresResponsable", "");
      asignar("edicionApellidosResponsable", "");
      asignar("edicionTelefonoResponsable", "");
    } else {
      asignar("edicionAdultoMiembro", "");
    }
  });
  $("edicionAdultoMiembro").addEventListener("change", () => {
    if (valor("edicionAdultoMiembro")) {
      asignar("edicionEstadoVinculo", "confirmado");
    }
  });

  // El campo de búsqueda rápida filtra los datos que ya están cargados.
  $("busquedaGeneral").addEventListener("input", () => aplicarFiltros(true));

  // Verificar sesión administrativa antes de consultar los datos.
  try {
    const { data, error } = await db.auth.getSession();
    if (error) throw error;
    if (!data?.session) {
      window.location.href = "acceso.html";
      return;
    }
  } catch (error) {
    console.error(error);
    mostrarEstado("estadoCarga", "No se pudo verificar la sesión administrativa. Revise el acceso e inténtelo de nuevo.", "error");
    return;
  }

  await recargarDatos(true);
}
