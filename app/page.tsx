import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">INNOVER STORE</h1>
          <p className="text-gray-600">Gestion Professionnelle de Boutique</p>
        </div>

        <div className="space-y-4">
          <Link
            href="/admin"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition block text-center"
          >
            📊 Admin Panel
          </Link>

          <Link
            href="/seller"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition block text-center"
          >
            🛒 Vendre un Article
          </Link>

          <Link
            href="/dashboard"
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition block text-center"
          >
            📈 Tableau de Bord
          </Link>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Configuration:</strong> Connectez votre compte Supabase dans les paramètres pour commencer.
          </p>
        </div>
      </div>
    </div>
  );
}
