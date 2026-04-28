import { BrowserRouter, Routes, Route } from "react-router-dom";

function AppTest() {
  return (
    <BrowserRouter>
      <div style={{padding: '20px'}}>
        <h1>Test App - Router works!</h1>
        <Routes>
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default AppTest;
