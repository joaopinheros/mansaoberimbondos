// ============================================================
// supabase.js
// Inicializa o cliente do Supabase e exporta para os outros
// módulos (app.js, faxinas.js, avisos.js, usuarios.js).
//
// IMPORTANTE: preencha SUPABASE_URL e SUPABASE_ANON_KEY com os
// dados do seu projeto (Project Settings > API no painel do
// Supabase). A "anon key" é pública por natureza — ela só
// funciona de acordo com as regras (RLS) que você configurar
// nas tabelas, então não tem problema ela aparecer no código
// que roda no navegador.
// ============================================================

const SUPABASE_URL = "https://pomzyztffnygofbkpfla.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvbXp5enRmZm55Z29mYmtwZmxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NDQ5MzAsImV4cCI6MjEwMDQyMDkzMH0.auHtggTjXG61k5cKads1r9xreEpGtU0gPh-SRyfVQjc";

// O SDK do Supabase é carregado via <script> no HTML (ver index.html,
// usuarios.html e avisos.html) e expõe o objeto global `supabase`.
// Aqui criamos o cliente e reexportamos com outro nome para não
// conflitar com o namespace global.
export const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
