import {
  useCallback,
  useEffect,
  useState
} from 'react'
import { useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { 
  Breadcrumb,
  Col,
  Container,
  Form,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap'
import { PlusSquare } from '@phosphor-icons/react'
import EditContact from './EditContact'
import Loading from '../common/Loading'
import TextInput from '../common/TextInput'
import Warning from '../common/Warning'
import { 
  apiLoader, 
  changeTitle,
  errorDisplay
} from '../../services/handler'

function ManageContacts() {

  const nowRunning = 'contacts/ManageContacts.jsx'
  changeTitle ( 'messagine: manage contacts')

  const [contacts, setContacts] = useState({})
  const defaultError = "The contacts manager isn't working right now"
  const [edit, setEdit] = useState()
  const [errorState, setErrorState] = useState({
    alreadyReported: false,
    context: '',
    details: 'general exception thrown',
    displayed: 56, // this is only useful when there are child components
    message: defaultError,
    number: 56,
    occurred: false,
  })
  const {
    level,
    toggleDimmer
  } = useOutletContext()
  const [loading, setLoading] = useState()
  const [loaded, setLoaded] = useState()
  const [originalContacts, setOriginalContacts] = useState({})

  const { register } = useForm()

  // Load all contact records

  const loadContacts = useCallback( async () => {

    const context = `${nowRunning}.loadContacts`

    try {

      toggleDimmer(true)
      const api = 'contacts/all'
      const payload = {}
      const { data } = await apiLoader({ api, payload })
      const {
        contacts,
        failure,
        success
      } = data

      // Reporting a failure from the API (already logged).
    
      if (!success) {
    
        if (+level === 9) console.log(`failure: ${failure}`)
    
        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          context,
          details: `failure: ${failure}`,
          errorAlreadyReported: true,
          message: `failure: ${failure}`, // Show the failure message on the modal.
          occurred: true
        }))
        return null
    
      }

      setContacts(contacts) // This can be filtered in onChange.
      setOriginalContacts(contacts)
      toggleDimmer(false)
      return true

    } catch(e) { // Reporting an exception within the function.

      if (+level === 9) console.log(`exception: ${e.message}`)
    
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))
  
    }

  }, [level, toggleDimmer])

  // Filter the contacts shown based on searchTerm.

  const onChange = async (e) => {

    const context = `${nowRunning}.onChange`
    
    try {

      const searchTerm = e.target.value.toLowerCase()

      if (!searchTerm) {

        setContacts(originalContacts) // Restore the original contacts before filtering started.
        return

      }

      const filteredContacts = Object.entries(originalContacts).reduce((acc, [contactId, contactDetails]) => {

        const {
          companyName = '', // Default to empty string if undefined
          contactName = '',
          contactNotes = '',
          email = '',
          sms = '',
          url = ''
        } = contactDetails;

        // Keep only those contacts that match the search term in any of these fields.

        if (contactDetails.contactName && (companyName.toLowerCase().includes(searchTerm) || contactName.toLowerCase().includes(searchTerm) || contactNotes.toLowerCase().includes(searchTerm) || email.toLowerCase().includes(searchTerm) || sms.toLowerCase().includes(searchTerm) || url.toLowerCase().includes(searchTerm))) acc[contactId] = contactDetails 
        return acc

      }, {})

      setContacts(filteredContacts)

    } catch(e) { // Reporting an exception within the function.

      if (+level === 9) console.log(`exception: ${e.message}`)
    
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))
  
    }

  }

  // Display function for showing (un)filtered results.

  const showContacts = () => {

    const context = `${nowRunning}.showContacts`

    try {

      const rows = Object.entries(contacts).map((contact, key) => {

        const contactId = contact[0]
        const {
          contactNotes,
          email,
          fullName,
        } = contact[1]

        return(

          <Row
            className="alternate-1 p-3"
            key={key}          
          >

            <Col 
              xs={12} sm={8}
              className="hover"
              onClick={ () => setEdit(contactId) }
            >

              <div className="size-65 text-muted">name</div>

              <div>{fullName}</div>

            </Col>

            <Col 
              xs={12} sm={4}
              className="hover"
              onClick={ () => setEdit(contactId) }
            >

              <div className="size-65 text-muted">email</div>

              <div>{email}</div>

            </Col>

            <div 
              className="size-65 hover"
              onClick={ () => setEdit(contactId) }
            >{contactNotes}</div>

            {edit === contactId && (

              <EditContact
                contact={contact[1]}
                contactId={contactId}
                loadContacts={loadContacts}
                setEdit={setEdit}
                updateErrorState={updateErrorState}
              />

            )}

          </Row>          

        )

      })

      return rows

    } catch(e) { // reporting an exception within the function

      if (+level === 9) console.log(`exception: ${e.message}`)
    
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))
  
    }

  }

  // updateErrorState can be passed to child components to allow them to update the parent when they have an error

  const updateErrorState = (newErrorState) => {

    setErrorState(prevState => ({
      ...prevState,
      ...newErrorState
    }));

  };

  useEffect( () => {

    const context = `${nowRunning}.useEffect`

    const runThis = async () => {
    
      if (!loading) {

        setLoading(true) // only do this once! 

        try {

          await loadContacts()
          setLoaded(true)

        } catch(e) { // reporting an exception within the function

          if (+level === 9) console.log(`exception: ${e.message}`)

          setErrorState(prevState => ({
            ...prevState,
            context,
            details: e.message,
            errorAlreadyReported: false,
            occurred: true
          }))
          setLoaded(true)

        }

      }

    }

    runThis()

  }, [level, loadContacts, loading, toggleDimmer])

  try {
    
    // Setup for error display and ( possible) reporting.

    let reportError = false // Default condition is there is no error.
    const {
      alreadyReported,
      context,
      details,
      message: errorMessage,
      errorNumber,
      occurred: errorOccurred
    } = errorState
    
    if ( errorOccurred && !alreadyReported) reportError = true // Persist this error to the Simplexable API..

    // Final setup before rendering..

    const contactsFound = Object.keys(originalContacts).length
    const filteredCount = Object.keys(contacts).length
    let counterText = contactsFound

    if (+contactsFound > +filteredCount) counterText = filteredCount + '/' + contactsFound

    return ( 
    
      <>

        {errorOccurred && ( 

          errorDisplay({
            context,
            details,
            errorMessage,
            errorNumber,
            nowRunning,
            reportError
          })

        )}

        {!loaded && (<Loading className="loading" message="loading the contact manager..." />)}

        {loaded && (
          
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

                {filteredCount < 1 && (<Warning message="The current search termas are returning no matches." />)}

                {filteredCount > 0 && (<Container className="border-gray-2 mt-3 mb-3 width-100">{showContacts()}</Container>)}

              </>

            )}

          </>

        )}

      </>

    )

  } catch( e) {

    if ( level === 9) console.log( `exception: ${e.message}`)

    toggleDimmer( false)
    setErrorState( prevState => ({
      ...prevState,
      context: nowRunning,
      details: e.message,
      errorAlreadyReported: false,
      occurred: true
    }))

  }

}

export default ManageContacts