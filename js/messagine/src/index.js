import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from "./App";
import LoginWithKey from "./components/users/LoginKey"
import ManageContacts from "./components/contacts/ManageContacts"
import ManageLists from "./components/lists/ManageLists"
import MessageEditor from "./components/campaigns/MessageEditor"
import NewContact from "./components/contacts/NewContact"
import NewList from "./components/lists/NewList"
import Upcoming from "./components/scheduler/Upcoming"

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
            element={ <ManageContacts /> }
            path="contacts/manage"
          />

          <Route 
            element={ <ManageLists /> }
            path="lists/manage"
          />

          <Route 
            element={ <MessageEditor /> }
            path="campaigns/edit/:campaignId/:messageId"
          />

          <Route 
            element={ <NewContact /> }
            path="contacts/new"
          />

          <Route 
            element={ <NewList /> }
            path="lists/new"
          />

          <Route 
            element={ <Upcoming /> }
            path="scheduler/upcoming"
          />

        </Route>

      </Routes>

    </BrowserRouter>

  </React.StrictMode>

);