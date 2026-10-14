import "./globals.css";

export const metadata = {
  title: "QB Report",
  description: "Upload a CSV, store it in MongoDB and view it as a table",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
