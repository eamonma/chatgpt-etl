import { Routes, Route, Outlet, useParams, useNavigate, useMatch } from "react-router-dom";
import { ConversationList } from "./components/ConversationList";
import { ConversationView } from "./components/ConversationView";

function Layout() {
  const match = useMatch("/c/:id");
  const selectedId = match?.params.id ?? null;

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`
          ${selectedId ? "hidden md:flex" : "flex"}
          flex-col w-full md:w-80 lg:w-96 border-r border-border
          bg-secondary/30 shrink-0
        `}
      >
        <div className="px-4 py-3 border-b border-border">
          <h1 className="text-lg font-semibold">ChatGPT Archive</h1>
        </div>
        <ConversationList selectedId={selectedId} />
      </aside>

      {/* Main content */}
      <main className={`
        ${selectedId ? "flex" : "hidden md:flex"}
        flex-col flex-1 min-w-0
      `}>
        <Outlet />
      </main>
    </div>
  );
}

function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <ConversationView
      conversationId={id}
      onBack={() => navigate("/")}
    />
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">
      <p className="text-lg">Select a conversation</p>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<EmptyState />} />
        <Route path="c/:id" element={<ConversationPage />} />
      </Route>
    </Routes>
  );
}
