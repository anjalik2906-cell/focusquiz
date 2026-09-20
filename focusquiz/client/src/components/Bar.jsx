export default function Bar({ children }) {
  return (
    <header className="bar">
      <span className="brand">FocusQuiz</span>
      {children}
    </header>
  );
}
