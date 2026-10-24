/* =====================================================
   REGISTRO DE DATOS DE MEMBRESÍA
   Conexión con Supabase
   ===================================================== */

// 1. Pegue aquí los datos públicos de su proyecto Supabase.
const SUPABASE_URL = "https://bfqhcoradcbgwpxrovvg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sXFKF4iU28RrK411PuK5Zg_J3DjNDZc";

// Crear conexión
window.supabaseCliente = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY   
);

document.addEventListener("DOMContentLoaded", () => {
    const formulario = document.getElementById("formularioMiembro");
   
const campoFoto = document.getElementById("foto_url");
const contenedorVistaPrevia = document.getElementById("contenedorVistaPrevia");
const vistaPreviaFoto = document.getElementById("vistaPreviaFoto");
const estadoVistaPrevia = document.getElementById("estadoVistaPrevia");

function obtenerUrlImagen(url) {
    if (!url) return "";

    try {
        const enlace = new URL(url);

        if (enlace.hostname === "drive.google.com") {
            const coincidencia = enlace.pathname.match(/\/file\/d\/([^/]+)/);

            if (coincidencia) {
                return "https://drive.google.com/uc?export=view&id=" +
                    encodeURIComponent(coincidencia[1]);
            }
        }

        return enlace.href;
    } catch {
        return "";
    }
}

if (campoFoto) {
    campoFoto.addEventListener("input", () => {
        const url = obtenerUrlImagen(campoFoto.value.trim());

        if (!url) {
            contenedorVistaPrevia.style.display = "none";
            vistaPreviaFoto.removeAttribute("src");
            estadoVistaPrevia.textContent = "";
            return;
        }

        contenedorVistaPrevia.style.display = "block";
        estadoVistaPrevia.textContent = "Cargando vista previa…";
        vistaPreviaFoto.src = url;
    });

    vistaPreviaFoto.addEventListener("load", () => {
        estadoVistaPrevia.textContent = "Vista previa disponible.";
    });

    vistaPreviaFoto.addEventListener("error", () => {
        estadoVistaPrevia.textContent =
            "No se pudo mostrar la imagen. Revise el enlace y sus permisos.";
    });
}

    const fechaNacimiento = document.getElementById("fecha_nacimiento");
    const campoEdad = document.getElementById("edad");

    const bautismoAgua = document.getElementById("bautismo_agua");
    const grupoLugarBautismo = document.getElementById("grupoLugarBautismo");
    const lugarBautismo = document.getElementById("lugar_bautismo");

    const grupoResponsable = document.getElementById("grupoResponsable");
    const botonEnviar = formulario?.querySelector(
        'button[type="submit"], input[type="submit"]'
    );

    if (!formulario) {
        console.error("No se encontró el formulario formularioMiembro.");
        return;
    }

    // Convertir una fecha DD/MM/AAAA a una fecha válida.
    function convertirFecha(fechaTexto) {
        if (!fechaTexto || !fechaTexto.trim()) {
            return { valida: true, fechaISO: null, edad: null };
        }

        const coincidencia = fechaTexto.trim().match(
            /^(\d{2})\/(\d{2})\/(\d{4})$/
        );

        if (!coincidencia) {
            return {
                valida: false,
                mensaje: "Escriba la fecha en formato DD/MM/AAAA."
            };
        }

        const dia = Number(coincidencia[1]);
        const mes = Number(coincidencia[2]);
        const anio = Number(coincidencia[3]);

        const fecha = new Date(anio, mes - 1, dia);

        if (
            fecha.getFullYear() !== anio ||
            fecha.getMonth() !== mes - 1 ||
            fecha.getDate() !== dia
        ) {
            return {
                valida: false,
                mensaje: "La fecha de nacimiento no es válida."
            };
        }

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        if (fecha > hoy) {
            return {
                valida: false,
                mensaje: "La fecha de nacimiento no puede ser futura."
            };
        }

        let edad = hoy.getFullYear() - anio;

        if (
            hoy.getMonth() < mes - 1 ||
            (hoy.getMonth() === mes - 1 && hoy.getDate() < dia)
        ) {
            edad--;
        }

        return {
            valida: true,
            fechaISO: `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`,
            edad
        };
    }

    // Actualizar la edad automáticamente.
    function actualizarEdad() {
        if (!fechaNacimiento || !campoEdad) return;

        const resultado = convertirFecha(fechaNacimiento.value);

        campoEdad.value = resultado.valida && resultado.edad !== null
            ? resultado.edad
            : "";
    }

    // Mostrar el lugar de bautismo solo cuando corresponda.
    function actualizarLugarBautismo() {
        if (!bautismoAgua || !grupoLugarBautismo) return;

        const mostrar = bautismoAgua.value.toLowerCase() === "si";

        grupoLugarBautismo.style.display = mostrar ? "" : "none";

        if (lugarBautismo) {
            lugarBautismo.required = mostrar;

            if (!mostrar) {
                lugarBautismo.value = "";
            }
        }
    }

    // Mostrar los datos del responsable cuando la persona es menor.
    function actualizarResponsable(edad) {
        if (!grupoResponsable) return;

        const esMenor = edad !== null && edad < 18;

        grupoResponsable.style.display = esMenor ? "" : "none";

        if (!esMenor) {
            const campos = grupoResponsable.querySelectorAll("input, select");
            campos.forEach(campo => {
                campo.value = "";
            });
        }
    }

    if (fechaNacimiento) {
        fechaNacimiento.addEventListener("input", () => {
            actualizarEdad();

            const resultado = convertirFecha(fechaNacimiento.value);
            actualizarResponsable(
                resultado.valida ? resultado.edad : null
            );
        });
    }

    if (bautismoAgua) {
        bautismoAgua.addEventListener("change", actualizarLugarBautismo);
    }

    actualizarEdad();
    actualizarLugarBautismo();

    const fechaInicial = convertirFecha(fechaNacimiento?.value || "");
    actualizarResponsable(
        fechaInicial.valida ? fechaInicial.edad : null
    );

    // Obtener el valor de un campo por su ID.
    function obtenerValor(id) {
        const campo = document.getElementById(id);
        return campo ? campo.value.trim() : "";
    }

    // Obtener las casillas seleccionadas.
    function obtenerSeleccionados(nombre) {
        return Array.from(
            formulario.querySelectorAll(
                `input[name="${nombre}"]:checked`
            )
        ).map(campo => campo.value);
    }

    // Enviar el formulario a la función segura de Supabase.
    formulario.addEventListener("submit", async (evento) => {
        evento.preventDefault();

        if (!formulario.reportValidity()) return;

        if (
            SUPABASE_URL.includes("PEGUE_AQUI") ||
            SUPABASE_ANON_KEY.includes("PEGUE_AQUI")
        ) {
            alert("Falta configurar la URL y la clave publicable de Supabase en datos-miembros.js.");
            return;
        }

        const resultadoFecha = convertirFecha(
            obtenerValor("fecha_nacimiento")
        );

        if (!resultadoFecha.valida) {
            alert(resultadoFecha.mensaje);
            fechaNacimiento?.focus();
            return;
        }

        if (
            resultadoFecha.edad !== null &&
            resultadoFecha.edad < 18 &&
            obtenerValor("parentesco") &&
            !obtenerValor("nombres_adulto_pendiente") &&
            !obtenerValor("apellidos_adulto_pendiente") &&
            !obtenerValor("telefono_adulto_pendiente")
        ) {
            alert("Ingrese al menos un dato del padre, madre o responsable.");
            return;
        }

        const datos = {
            nombres: obtenerValor("nombres"),
            apellidos: obtenerValor("apellidos"),
            fecha_nacimiento: resultadoFecha.fechaISO,
            telefono_principal: obtenerValor("telefono_principal"),
            telefono_alternativo: obtenerValor("telefono_alternativo"),
            estado_civil: obtenerValor("estado_civil"),
            lugar_nacimiento: obtenerValor("lugar_nacimiento"),
            bautismo_agua: obtenerValor("bautismo_agua"),
            lugar_bautismo: obtenerValor("lugar_bautismo"),
            bautismo_espiritu_santo: obtenerValor("bautismo_espiritu_santo"),
            profesion_ocupacion: obtenerValor("profesion_ocupacion"),
            nivel_academico: obtenerValor("nivel_academico"),
            organizaciones: obtenerSeleccionados("organizaciones"),
            estudios_biblicos: obtenerSeleccionados("estudios_biblicos"),
            nombres_adulto_pendiente: obtenerValor("nombres_adulto_pendiente"),
            apellidos_adulto_pendiente: obtenerValor("apellidos_adulto_pendiente"),
            telefono_adulto_pendiente: obtenerValor("telefono_adulto_pendiente"),
            parentesco: obtenerValor("parentesco")
        };

        try {
            if (botonEnviar) {
                botonEnviar.disabled = true;
                botonEnviar.textContent = "Guardando...";
            }

            const { data, error } = await supabaseCliente.rpc(
                "registrar_miembro",
                { p_datos: datos }
            );

                        if (error) {
                console.error("Error de Supabase:", error);
                alert(
                    "No se pudo guardar el registro. " +
                    "Revise la conexión y la configuración de Supabase. " +
                    "Detalle: " + error.message
                );
                return;
            }

            if (data && data.duplicado === true) {
                alert(
                    "⚠️ Posible registro duplicado\n\n" +
                    data.mensaje
                );
                return;
            }

            const respuesta = Array.isArray(data) ? data[0] : data;

            if (!respuesta || respuesta.exito !== true) {
                console.error("Respuesta inesperada:", data);
                alert("No se confirmó el registro. Verifique Supabase antes de volver a intentarlo.");
                return;
            }

            alert(
                "Registro guardado correctamente.\n\n" +
                "Código de miembro: " + respuesta.codigo_miembro
            );

            formulario.reset();
            actualizarEdad();
            actualizarLugarBautismo();
            actualizarResponsable(null);

        } catch (error) {
            console.error("Error al enviar el formulario:", error);
            alert("Ocurrió un problema de conexión. Inténtelo nuevamente.");
        } finally {
            if (botonEnviar) {
                botonEnviar.disabled = false;
                botonEnviar.textContent = "Continuar";
            }
        }
    });
});
