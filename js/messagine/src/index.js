import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from "./App";
import LoginWithKey from "./components/users/LoginKey"
import ManageLists from "./components/lists/ManageLists"
import NewList from "./components/lists/NewList"

const container = document.getElementById('root');
const root = createRoot(container);

root.render(

  <React.StrictMode>

    <BrowserRouter>

      <Routes>

        <Route 
          element={ <LoginWithKey /> }
          path="key/:key"
        />

        <Route
          element={ <App/ > }
          path="/"
        >

          <Route 
            element={ <ManageLists /> }
            path="lists/manage"
          />

          <Route 
            element={ <NewList /> }
            path="lists/new"
          />

        </Route>

      </Routes>

    </BrowserRouter>

  </React.StrictMode>

);
