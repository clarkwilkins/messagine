import { 
  useCallback,
  useEffect,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Joi from 'joi'
import { joiResolver } from '@hookform/resolvers/joi'
import { 
  Breadcrumb,
  Button,
  Col,
  Container,
  Form,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap'
import { 
  Gear,
  List,
  PlusSquare,
  UserGear
} from '@phosphor-icons/react'
import Loading from '../common/Loading'
import Selector from '../common/Selector'
import TextInput from '../common/TextInput'
import { 
  apiLoader, 
  changeTitle,
  errorDisplay
} from '../../services/handler'

function ManageLists() {

  const nowRunning = 'lists/ManageLists.jsx'
  changeTitle ('messagine: lists management')

  const [allContacts, setAllContacts] = useState({})
  const [availableContacts, setAvailableContacts] = useState({})
  const defaultError = "The lists management tool isn't working right now"
  const [errorAlreadyReported, setErrorAlreadyReported] = useState(false)
  const [errorContext, setErrorContext] = useState(nowRunning + '.e')
  const [errorContextReported, setErrorContextReported] = useState()
  const [errorDetails, setErrorDetails] = useState('general exception thrown')
  const [errorDisplayed, setErrorDisplayed] = useState() // latch the error unless it changes
  const [errorMessage, setErrorMessage] = useState(defaultError)
  const [errorNumber, setErrorNumber] = useState(50)
  const [errorOccurred, setErrorOccurred] = useState(false)
  const {
    level,
    toggleDimmer
  } = useOutletContext();
  const [linkedContacts, setLinkedContacts] = useState()
  const [linkedContactsCount, setLinkedContactsCount] = useState(0)
  const [listData, setListData] = useState()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const schema = Joi.object( {
    acceptContacts: Joi.boolean().optional(),
    active: Joi.boolean().optional(),
    apiTesting: Joi.boolean().optional(),
    listId: Joi.string().required().uuid(),
    listName: Joi.string().required(),
    listNotes: Joi.string().optional().allow( '', null ),
    locked: Joi.boolean().optional().allow( '', null ),
    masterKey: Joi.any(),
    userId: Joi.string().required().uuid()
  } )
  const [showContacts, setShowContacts] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [showSettings, setShowSettings] = useState(true)

  const { 
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    setValue,
    trigger
  } = useForm({ resolver: joiResolver( schema )} )

  const manageLink = async (contactId, link) => {

    try {

      const api = 'lists/contact-linking'
      const payload = {
        contactId,
        link,
        listId: getValues().listId
      }
      const { data }= await apiLoader({ api, payload })
      const {
        failure,
        success
      } = data;

      if (!success) {

        toggleDimmer(false)
        const context = nowRunning + '.manageLink'
        setErrorAlreadyReported(true)
        setErrorContext(context)
        setErrorDetails(`failure: ${failure}`)
        setErrorMessage(defaultError)
        setErrorOccurred(true)
        return null

      }

    } catch(e) {

      setErrorAlreadyReported(false)
      setErrorContext(`${nowRunning}.manageLink.(general exception)`)
      setErrorDetails('exception thrown')
      setErrorMessage(defaultError)
      setErrorOccurred(true)

    }

    await getListData()

    if (!link) await getAllContacts()

  }

  const onChange = () => { trigger() } // validate the update form

  const getAllContacts = useCallback( async () => { // get all active contacts

    try {

      const api = 'contacts/all'
      const payload = { active: true }
      const { data } = await apiLoader({ api, payload })
      const {
        contacts,
        failure,
        success
      } = data

      if (!success) {

        toggleDimmer(false)
        const context = `${nowRunning}.getAllContacts`

        if ( +level === 9 ) console.log(`${context}.failure: ${failure}`);

        setErrorAlreadyReported(true)
        setErrorContext(context)
        setErrorDetails(`failure: ${failure}`)
        setErrorMessage(defaultError)
        setErrorNumber(errorNumber)
        setErrorOccurred(true)
        return null

      }

      setAllContacts(contacts)
      setAvailableContacts(contacts)

    } catch(e) {

      toggleDimmer(false)
      setErrorAlreadyReported(false)
      setErrorContext(`${nowRunning}.getAllContacts.(general exception)`)
      setErrorDetails('exception thrown')
      setErrorMessage(defaultError)
      setErrorOccurred(true)

    }

  }, [errorNumber, level, toggleDimmer])

  const getAllLists = useCallback( async () => { // get all active lists

    try {

      const api = 'lists/all'
      const payload = {}
      const { data } = await apiLoader({ api, payload })
      const { 
        failure,
        listsSelector,
        success 
      } = data

      if (!success) {

        toggleDimmer(false)
        const context = `${nowRunning}.getAllLists(getting all active mailing lists)`

        if ( +level === 9 ) console.log(`${context}.failure: ${failure}`);

        setErrorAlreadyReported(true)
        setErrorContext(context)
        setErrorDetails(`failure: ${failure}`)
        setErrorMessage(defaultError)
        setErrorNumber(errorNumber)
        setErrorOccurred(true)
        return null

      }

      setLists(listsSelector)

    } catch(e) {

      toggleDimmer(false)
      setErrorAlreadyReported(false)
      setErrorContext(`${nowRunning}.getAllContacts.(general exception)`)
      setErrorDetails('exception thrown')
      setErrorMessage(defaultError)
      setErrorOccurred(true)

    }

  }, [errorNumber, level, toggleDimmer])

  const getListData = async () => {

    try {

      setValue( 'listName', null )
      setShowEditor(false)
      setListData()

      const { listId } = getValues()

      if (!listId ) return

      const api = 'lists/load'
      const payload = { listId }
      const { data } = await apiLoader({ api, payload })
      const {
        acceptsContacts,
        active,
        failure,
        linkedContacts,
        listName,
        listNotes,
        locked,
        success,
        updated,
        updatedBy2
      } = data
      
      if (!success) {

        toggleDimmer(false)
        const context = nowRunning + '.getListData'
        setErrorAlreadyReported(true)
        setErrorContext(context)
        setErrorDetails(`failure: ${failure}`)
        setErrorMessage(defaultError)
        setErrorOccurred(true)
        return null

      }

      console.log(availableContacts)

      setLinkedContacts(linkedContacts) // contacts on this list
      setLinkedContactsCount(Object.keys(linkedContacts).length)
      setListData(data)
      setShowEditor(true)
      setValue( 'listName', listName)

    } catch(e) {

      setErrorAlreadyReported(false)
      setErrorContext(`${nowRunning}.getListData.(general exception)`)
      setErrorDetails('exception thrown')
      setErrorMessage(defaultError)
      setErrorOccurred(true)

    }

  }

  const onSubmit = async () => {

    try {

      const api = 'lists/update'
      const payload = { ...getValues() }
      const { data } = await apiLoader({ api, payload })
      console.log(data)

    } catch(e) {

      setErrorAlreadyReported(false)
      setErrorContext(`${nowRunning}.onSubmit.(general exception)`)
      setErrorDetails('exception thrown')
      setErrorMessage(defaultError)
      setErrorOccurred(true)

    }

  }

  // const showRows = () => {

  //   const contactsWhichAreNotSelected = availableContacts; // so we don't directly mutate state
  //   const inUse = [];
  //   Object.entries(linkedContacts).map(row => {
  //     inUse.push({
  //       contactId: row[0],
  //       ...row[1]
  //     })
  //     delete availableContacts[row[0]] // it's already in use
  //     return null    
  //   })

  //   const rows = Object.entries(contactsWhichAreNotSelected).map( (row, key) => {

  //     const contactId = row[0]
  //     const {
  //       blockAll,
  //       contactNotes,
  //       email,
  //       fullName
  //     } = row[1]

  //     if ( blockAll === true ) return null

  //     if (!inUse[key]) inUse[key] = {}      

  //     return(

  //       <Row className="alternate-1 p-2">

  //         <Col 
  //           xs={6} 
  //           className="hover"
  //           onClick={ () => manageLink(contactId, true) } 
  //         >
  //           <div>{fullName}</div>
  //           <div className="size-80">{email}</div>
  //           <div className="size-80">{contactNotes}</div>
  //         </Col>
  //         <Col 
  //           xs={6} 
  //           className="hover"
  //         >

  //           {inUse[key] && (

  //             <div onClick={ () => manageLink(inUse[key].contactId, false) }>
  //               <div>{inUse[key].fullName}</div>
  //               <div className="size-80">{inUse[key].email}</div>
  //               <div className="size-80">{inUse[key].contactNotes}</div>
  //             </div>

  //           )}

  //         </Col>

  //       </Row>

  //     )
      
  //   })

  //   return rows

  // }

  function showRows() { // c/o ChatGPT4 with very light editing

    // filter out the linked contacts from allContacts

    const filteredContacts = Object.keys(allContacts).reduce((acc, contactId) => {

      if (!linkedContacts.hasOwnProperty(contactId)) acc[contactId] = allContacts[contactId]
      
      return acc

    }, {});
  
    // calculate the maximum length to ensure we iterate over both objects fully

    const maxLength = Math.max(Object.keys(filteredContacts).length, Object.keys(linkedContacts).length)
  
    // creating rows for display

    const rows = [];

    for (let i = 0; i < maxLength; i++) {

      const filteredContactIds = Object.keys(filteredContacts)
      const linkedContactIds = Object.keys(linkedContacts)
  
      const filteredContactId = filteredContactIds[i]
      const linkedContactId = linkedContactIds[i]
  
      const filteredContact = filteredContacts[filteredContactId]
      const linkedContact = linkedContacts[linkedContactId]
  
      rows.push(

        <Row className="alternate-1 p-2">

          <Col 
            xs={6} className="hover" 
            onClick={() => filteredContact && manageLink(filteredContactId, true)}
          >
            {filteredContact ? (
              <>
                <div>{filteredContact.fullName}</div>
                <div className="size-80">{filteredContact.email}</div>
                <div className="size-80">{filteredContact.contactNotes}</div>
              </>
            ) : <div>&nbsp;</div>}
          </Col>

          <Col 
            xs={6} className="hover" 
            onClick={() => linkedContact && manageLink(linkedContactId, false)}
          >
            {linkedContact ? (
              <>
                <div>{linkedContact.fullName}</div>
                <div className="size-80">{linkedContact.email}</div>
                <div className="size-80">{linkedContact.contactNotes}</div>
              </>
            ) : <div>&nbsp;</div>}
          </Col>

        </Row>

      );
    }
  
    return rows;
  }
  

  const toggleContacts = () => setShowContacts( !showContacts );

  const toggleEditor = () => setShowEditor( !showEditor );

  const toggleSettings = () => setShowSettings( !showSettings );

  useEffect(() => {

    const runThis = async () => {

      try {

        if ( !loading ) {

          setLoading(true) // only do this once!          
          toggleDimmer(true)
          await getAllContacts()
          await getAllLists()
          setLoaded(true)
          toggleDimmer(false)

        }

      } catch (e) {
      
        toggleDimmer(false)
        const context = `${nowRunning}.useEffect`

        if ( +level === 9 ) console.log(e);

        setErrorAlreadyReported(false)
        setErrorContext(`${context}: exception thrown`)
        setErrorDetails(e.message)
        setErrorMessage(defaultError)
        setErrorNumber(errorNumber); 
        setErrorOccurred(true)
      
      }

    }

    runThis()

  }, [errorNumber, getAllContacts, level, toggleDimmer])

  try {
    
    let reportError = false; // default condition is there is no error

    if (errorOccurred && errorNumber !== errorDisplayed && errorContext !== errorContextReported && !errorAlreadyReported) { 
                
      reportError = true; 
      setErrorContextReported(errorContext)
      setErrorDisplayed(errorNumber); 

    }

    if ( level === 9 && Object.keys( errors ).length > 0 ) console.log( 'validation errors: ', errors );

    const locked = listData?.locked
    console.log()

    return (
    
      <>

        {errorOccurred && (

          errorDisplay({
            context: errorContext,
            details: errorDetails,
            errorMessage,
            errorNumber,
            nowRunning,
            reportError
          })

        )}

        {!loaded && (<Loading className="loading" message="loading the lists manager..." />)}

        {loaded && (
          
          <>

            <Breadcrumb className="size-50 text-muted mb-3">

              <Breadcrumb.Item>lists</Breadcrumb.Item>
              <Breadcrumb.Item>manage</Breadcrumb.Item>

            </Breadcrumb>

            <h5 className="floats">

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ ( props ) => ( 
                    <Tooltip { ...props }>
                      {showSettings && (<span>hide lists</span>)}
                      {!showSettings && (<span>show lists</span>)}
                    </Tooltip>
                  )}
                  placement="bottom"
                >

                  <div onClick={ () => toggleSettings() }><List /></div>
                  
                </OverlayTrigger>
                
              </div>

              {listData && (

                <>

                  <div className="float-right ml-05">

                    <OverlayTrigger
                      delay={ {  hide: 100, show: 200 } }
                      overlay={ ( props ) => ( 
                        <Tooltip { ...props }>
                          {showEditor && (<span>hide editor</span>)}
                          {!showEditor && (<span>show editor</span>)}
                        </Tooltip>
                      )}
                      placement="bottom"
                    >

                      <div onClick={ () => toggleEditor() }><Gear /></div>
                      
                    </OverlayTrigger>

                  </div>

                  <div className="float-right ml-05">

                    <OverlayTrigger
                      delay={ {  hide: 100, show: 200 } }
                      overlay={ ( props ) => ( 
                        <Tooltip { ...props }>
                          {showContacts && (<span>hide contacts</span>)}
                          {!showContacts && (<span>show contacts</span>)}
                        </Tooltip>
                      )}
                      placement="bottom"
                    >

                      <div onClick={ () => toggleContacts() }><UserGear /></div>
                      
                    </OverlayTrigger>

                  </div>

                </>

              )}

              mailing lists

            </h5>

            {showSettings && (

              <>

                <div className="bg-light p-3 mb-3">

                  <Selector
                    complex={true}
                    inputName="listId"
                    label="mailing list"
                    onChange={ () => getListData() }
                    placeholder="please select a list to continue..."
                    register={register}
                    values={lists}
                  />

                </div>

              </>

            )}

            {showEditor && (

              <Form 
                className="bg-light p-3 mb-3"
                onSubmit={handleSubmit( onSubmit )}    
              >

                <div className="size-80"><b>list setup</b></div>

                <Row>

                  <Col xs={12} sm={6}>

                    <TextInput
                      disabled={ locked > level }
                      errors={errors.listName}
                      inputName="listName"
                      label="list name"
                      onChange={onChange}
                      placeholder="the list name cannot be empty"
                      register={register}
                    />

                  </Col>

                </Row>

              </Form>

            )}

            {showContacts && (

              <>


                <div className="bg-light p-3 mb-3">

                  <div className="mb-3 size-80"><b>contacts ({linkedContactsCount})</b></div>
                    
                  <Container className="border-gray-1 size-80">

                    <Row className="p-2 alternate-1">

                      <Col xs={12} sm={6}><b>available</b></Col>

                      <Col xs={12} sm={6}><b>in use</b></Col>

                    </Row>

                    {showRows()}

                  </Container>

                </div>

              </>

            )}

          </>

        )}

      </>

   )

  } catch(e) {
  
    if (+level === 9) console.log(`{$nowRunning}.exception: ${e.message}`)

    toggleDimmer(false)
    setErrorAlreadyReported(false);
    setErrorContext(`${nowRunning}.e`);
    setErrorDetails('general exception thrown');
    setErrorMessage(e.message);
    setErrorNumber(errorNumber);
    setErrorOccurred(true);

  }

}

export default ManageLists;