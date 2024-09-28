import {
  useCallback,
  useEffect,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { 
  Breadcrumb,
  Col,
  Container,
  Form,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap';
import { PlusSquare } from '@phosphor-icons/react';
import EditContact from './EditContact';
import ErrorBoundary from '../common/ErrorBoundary';
import Loading from '../common/Loading';
import TextInput from '../common/TextInput';
import Warning from '../common/Warning';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import { changeTitle } from '../../services/utils';

function ManageContactsComponent({ handleError }) {

  const nowRunning = 'contacts/ManageContacts.jsx';
  changeTitle('messagine: manage contacts');

  const [state, setState] = useState({
    contacts: {},
    edit: null,
    loaded: false,
    originalContacts: {}
  });

  const { 
    contacts, 
    edit, 
    loaded, 
    originalContacts
  } = state;

  const { 
    setLoadingMessages,
    userId // needed for error logging
  } = useOutletContext();
    
  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);
   
  const { register } = useForm();

  // Load all contact records

  const loadContacts = useCallback(async () => {

    const context = `${nowRunning}.loadContacts`;
    const loadingMessage = `loading contacts...`;

    try {

      addLoadingMessage(loadingMessage);
      const api = 'contacts/all';
      const payload = {};
      const { data } = await apiLoader({ api, payload });
      const {
        contacts,
        failure,
        success
      } = data;

      if (!success) {
    
        await handleError({ 
          failure,
          nowRunning: context,
          userId
        });
        return null;
    
      }

      setState((prevState) => ({
        ...prevState,
        contacts: contacts,
        originalContacts: contacts
      }));

      removeLoadingMessage(loadingMessage);
      return true;

    } catch (error) {

      await handleError({
        error,
        nowRunning: context,
        userId
      });
  
    }

  }, [addLoadingMessage, handleError, removeLoadingMessage, userId]);

  // Filter the contacts shown based on searchTerm.

  const onChange = async (e) => {

    const context = `${nowRunning}.onChange`;
    
    try {

      const searchTerm = e.target.value.toLowerCase();

      if (!searchTerm) {
        setState((prevState) => ({
          ...prevState,
          contacts: originalContacts
        }));
        return;
      }

      const filteredContacts = Object.entries(originalContacts).reduce((acc, [contactId, contactDetails]) => {

        const {
          companyName = '', 
          contactName = '',
          contactNotes = '',
          email = '',
          sms = '',
          url = ''
        } = contactDetails;

        if (contactDetails.contactName && (
          companyName.toLowerCase().includes(searchTerm) ||
          contactName.toLowerCase().includes(searchTerm) ||
          contactNotes.toLowerCase().includes(searchTerm) ||
          email.toLowerCase().includes(searchTerm) ||
          sms.toLowerCase().includes(searchTerm) ||
          url.toLowerCase().includes(searchTerm)
        )) acc[contactId] = contactDetails;

        return acc;

      }, {});

      setState((prevState) => ({
        ...prevState,
        contacts: filteredContacts
      }));

    } catch (error) { 

      handleError({
        error,
        nowRunning: context,
        userId
      });
  
    }

  };

  // Display function for showing (un)filtered results.

  const showContacts = () => {

    const context = `${nowRunning}.showContacts`;

    try {

      const rows = Object.entries(contacts).map((contact, key) => {

        const contactId = contact[0];
        const {
          contactNotes,
          email,
          fullName,
        } = contact[1];

        return (

          <Row
            className="alternate-1 p-3"
            key={key}
          >

            <Col 
              xs={12} sm={8}
              className="hover"
              onClick={ () => setState((prevState) => ({
                ...prevState,
                edit: contactId
              }))}
            >

              <div className="size-65 text-muted">name</div>

              <div>{fullName}</div>

            </Col>

            <Col 
              xs={12} sm={4}
              className="hover"
              onClick={ () => setState((prevState) => ({
                ...prevState,
                edit: contactId
              }))}
            >

              <div className="size-65 text-muted">email</div>

              <div>{email}</div>

            </Col>

            <div 
              className="size-65 hover"
              onClick={ () => setState((prevState) => ({
                ...prevState,
                edit: contactId
              }))}
            >
              {contactNotes}
            </div>

            {edit === contactId && (

              <EditContact
                contact={contact[1]}
                contactId={contactId}
                loadContacts={loadContacts}
                setEdit={(edit) => setState((prevState) => ({
                  ...prevState,
                  edit
                }))}
              />

            )}

          </Row>

        );

      });

      return rows;

    } catch (error) {

      handleError({ 
        error,
        nowRunning: context,
        userId
      });
  
    }

  };

  useEffect(() => {

    const context = `${nowRunning}.useEffect`;

    const runThis = async () => {
    
      if (!loaded) {

        await loadContacts();
        setState((prevState) => ({
          ...prevState,
          loaded: true
        }));

      }

    };

    runThis().catch(error => {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    });

  }, [handleError, loadContacts, loaded, userId]);

  try {

    const contactsFound = Object.keys(originalContacts).length;
    const filteredCount = Object.keys(contacts).length;
    let counterText = contactsFound;

    if (+contactsFound > +filteredCount) counterText = `${filteredCount}/${contactsFound}`;

    if (!loaded) return <Loading className="loading" message="loading the contact manager..." />;

    return ( 
    
      <>

        <Breadcrumb className="size-50 text-muted mb-3">

          <Breadcrumb.Item>contacts</Breadcrumb.Item>
          <Breadcrumb.Item>manage</Breadcrumb.Item>

        </Breadcrumb>

        <h5 className="floats">

          <div className="float-right ml-05">

            <OverlayTrigger
              delay={ {  hide: 100, show: 200 } }
              overlay={ (props) => (
                <Tooltip { ...props }>
                  new contact
                </Tooltip>
            )}
              placement="bottom"
            >

              <a href="./new"><PlusSquare /></a>
              
            </OverlayTrigger>
            
          </div>
          
          manage contacts ({counterText})

        </h5>

        {!contactsFound && (<Warning message="You don't have any contacts defined." />)}

        {contactsFound && (

          <>

            <Form className="bg-light p-3 mt-3 mb-3">

              <TextInput
                inputName="searchTerm"
                label="search contacts"
                onChange={(e) => onChange(e)}
                placeholder="search contacts for this string..."
                register={register}
              />

            </Form>

            {filteredCount < 1 && (<Warning message="The current search terms are returning no matches." />)}

            {filteredCount > 0 && (<Container className="border-gray-2 mt-3 mb-3 width-100">{showContacts()}</Container>)}

          </>

        )}

      </>

    );

  } catch (error) {

    handleError({
      error,
      nowRunning,
      userId
    });

  }

}

export default function ManageContacts(props) {

  const defaultProps = {
    ...props,
    defaultError: "The contacts manager isn't working right now.",
    errorNumber: 56
  };

  return (

    <ErrorBoundary
      context="contacts/ManageContacts.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <ManageContactsComponent {...defaultProps} />
    </ErrorBoundary>

  );

}