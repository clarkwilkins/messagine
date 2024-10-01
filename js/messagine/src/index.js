import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import App from "./App";
import EditCampaign from "./components/campaigns/EditCampaign"
import LoginWithKey from "./components/users/LoginKey"
import ManageCampaigns from "./components/campaigns/ManageCampaigns"
import ManageContacts from "./components/contacts/ManageContacts"
import ManageLists from "./components/lists/ManageLists"
import MessageEditor from "./components/campaigns/MessageEditor"
import NewCampaign from "./components/campaigns/NewCampaign"
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
            element={ <EditCampaign /> }
            path="campaigns/edit/:campaignId/"
          />

          <Route 
            element={ <ManageCampaigns /> }
            path="campaigns/manage"
          />

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
            element={ <NewCampaign /> }
            path="campaigns/new"
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