
const formularioAcceso = document.getElementById("formularioAcceso");
const mensajeAcceso = document.getElementById("mensajeAcceso");
const botonAcceso = document.getElementById("botonAcceso");

formularioAcceso.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const correo = document.getElementById("correo").value.trim();
    const contrasena = document.getElementById("contrasena").value;

    mensajeAcceso.textContent = "Verificando acceso...";
    botonAcceso.disabled = true;

    try {
        const cliente = window.supabaseCliente;

        if (!cliente) {
            throw new Error("No se encontró la conexión con Supabase.");
        }

        const { data, error } = await cliente.auth.signInWithPassword({
            email: correo,
            password: contrasena
        });

        if (error) {
            throw error;
        }

        if (!data.session) {
            throw new Error("No se pudo iniciar la sesión.");
        }

        window.location.href = "administracion.html";

    } catch (error) {
        console.error("Error de acceso:", error);

        mensajeAcceso.textContent =
            "No se pudo iniciar sesión. Verifique sus datos e inténtelo nuevamente.";

    } finally {
        botonAcceso.disabled = false;
    }
});
