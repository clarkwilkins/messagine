import { 
  useCallback,
  useEffect,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import Joi from 'joi'
import { joiResolver } from '@hookform/resolvers/joi'
import { toast } from 'react-toastify'
import { 
  Breadcrumb,
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
import CheckBoxInput from '../common/CheckBoxInput'
import DeleteConfirmationModal from '../common/DeleteConfirmationModal'
import FormButtons from '../common/FormButtons'
import Loading from '../common/Loading'
import Selector from '../common/Selector'
import TextArea from '../common/TextArea'
import TextInput from '../common/TextInput'
import { 
  apiLoader, 
  changeTitle,
  errorDisplay,
  validateUUID
} from '../../services/handler'

function ManageLists() {

  const nowRunning = 'lists/ManageLists.jsx'
  changeTitle ('messagine: lists management')

  const [allContacts, setAllContacts] = useState({})
  const defaultError = "The lists management tool isn't working right now"
  const [errorState, setErrorState] = useState({
    alreadyReported: false,
    context: '',
    details: 'general exception thrown',
    displayed: 50, // this is only useful when there are child components
    message: defaultError,
    number: 50,
    occurred: false,
  })
  const {
    level,
    toggleDimmer
  } = useOutletContext()
  const [linkedContacts, setLinkedContacts] = useState()
  const [linkedContactsCount, setLinkedContactsCount] = useState(0)
  const [listData, setListData] = useState()
  const [lists, setLists] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const schema = Joi.object({
    acceptContacts: Joi.boolean().optional(),
    active: Joi.boolean().optional(),
    apiTesting: Joi.boolean().optional(),
    listId: Joi.string().required().uuid(),
    listName: Joi.string().required(),
    listNotes: Joi.string().optional().allow('', null),
    locked: Joi.boolean().optional().allow('', null)
  })
  const [showContacts, setShowContacts] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [showModal, setDisplayConfirmationModal] = useState(false)
  const [showSettings, setShowSettings] = useState(true)

  const { 
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
    trigger
  } = useForm({ resolver: joiResolver(schema)})

  const getAllContacts = useCallback(async () => { // get all active contacts

    const context = `${nowRunning}.getAllContacts`

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

        if (level === 9) console.log(`failure: ${failure}`)

        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          context,
          errorAlreadyReported: true,
          message: `failure: ${failure}`,
          occurred: true
        }))
        return null

      }

      setAllContacts(contacts)

    } catch(e) {

      if (level === 9) console.log(`exception: ${e.message}`)

      toggleDimmer(false)
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))

    }

  }, [level, toggleDimmer])

  const getAllLists = useCallback(async () => { // get all active lists

    const context = `${nowRunning}.getAllLists`

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

        if (level === 9) console.log(`failure: ${failure}`)

        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          context,
          errorAlreadyReported: true,
          message: `failure: ${failure}`,
          occurred: true
        }))
        return null

      }

      setLists(listsSelector)

    } catch(e) {

      if (level === 9) console.log(`exception: ${e.message}`)

      toggleDimmer(false)
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))

    }

  }, [level, toggleDimmer])

  const getListData = async () => {

    const context = `${nowRunning}.getListData`

    try {

      setValue('listName', null)
      setShowEditor(false)
      setListData()

      const { listId } = getValues()

      if (!listId) {
        
        setLinkedContacts({})
        setLinkedContactsCount(0)
        setListData({})
        setShowEditor(false)
        return 

      }

      const api = 'lists/load'
      const payload = { listId }
      const { data } = await apiLoader({ api, payload })
      const {
        acceptContacts,
        active,
        failure,
        linkedContacts,
        listName,
        listNotes,
        locked,
        success
      } = data
      
      if (!success) {

        if (level === 9) console.log(`failure: ${failure}`)

        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          context,
          errorAlreadyReported: true,
          message: `failure: ${failure}`,
          occurred: true
        }))
        return null

      }

      setLinkedContacts(linkedContacts) // contacts on this list
      setLinkedContactsCount(Object.keys(linkedContacts).length)
      setListData(data)
      setShowContacts(true)
      setValue('acceptContacts', acceptContacts)
      setValue('active', active)
      setValue('listName', listName)
      setValue('listNotes', listNotes)
      setValue('locked', locked >= level)

    } catch(e) {

      toggleDimmer(false)
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))

    }

  }

  const hideConfirmationModal = () => { setDisplayConfirmationModal(false); }

  const manageLink = async (contactId, link) => {

    const context = `${nowRunning}.manageLink`

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
      } = data

      if (!success) {

        if (level === 9) console.log(`failure: ${failure}`)

        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          context,
          errorAlreadyReported: true,
          message: `failure: ${failure}`,
          occurred: true
        }))
        return null

      }

    } catch(e) {

      if (level === 9) console.log(`exception: ${e.message}`)

      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))

    }

    await getListData()

    if (!link) await getAllContacts()

  }

  const onChange = () => { trigger() } // validate the update form

  const onDelete = async () => {

    const context = `${nowRunning}.onDelete`

    try {

      toggleDimmer(true)
      const { listId } = getValues()
      const api = 'lists/delete'
      const payload = { listId }
      const { data } = await apiLoader({ api, payload })
      const {
        failure,
        success
      } = data
      
      if (!success) {

        if (level === 9) console.log(`failure: ${failure}`)
    
        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          context,
          errorAlreadyReported: true,
          message: `failure: ${failure}`,
          occurred: true
        }))
        return null
    
      }

      setLinkedContacts({})
      setLinkedContactsCount(0)
      setListData({})
      setShowEditor(false)
      setValue('listId', null)
      await updateList()
      reset()
      toast.success('The mailing list was deleted.')
      toggleDimmer(false)

    } catch(e) {

      if (level === 9) console.log(`exception: ${e.message}`)

      toggleDimmer(false)
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))

    }

  }

  const onReset = async () => {
    
    await getListData()
    setShowEditor(true)

  }

  const onSubmit = async () => {

    const context = `${nowRunning}.onSubmit`

    try {

      toggleDimmer(true)
      const api = 'lists/update'
      const payload = { ...getValues() }
      const { data } = await apiLoader({ api, payload })
      const {
        failure,
        success
      } = data
      
      if (!success) {

        if (level === 9) console.log(`failure: ${failure}`)
    
        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          context,
          errorAlreadyReported: true,
          message: `failure: ${failure}`,
          occurred: true
        }))
        return null
    
      }

      await getListData() // refresh
      toast.success('The list setup was updated.')
      toggleDimmer(false)

    } catch(e) {

      if (level === 9) console.log(`exception: ${e.message}`)

      toggleDimmer(false)
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        errorAlreadyReported: false,
        occurred: true
      }))

    }

  }

  const showConfirmationModal = () => { setDisplayConfirmationModal(true); }

  function showRows() { // c/o ChatGPT4 with very light editing

    // filter out the linked contacts from allContacts

    const filteredContacts = Object.keys(allContacts).reduce((acc, contactId) => {

      if (!linkedContacts.hasOwnProperty(contactId)) acc[contactId] = allContacts[contactId]
      
      return acc

    }, {})
  
    // calculate the maximum length to ensure we iterate over both objects fully

    const maxLength = Math.max(Object.keys(filteredContacts).length, Object.keys(linkedContacts).length)
  
    // creating rows for display

    const rows = []

    for (let i = 0; i < maxLength; i++) {

      const filteredContactIds = Object.keys(filteredContacts)
      const linkedContactIds = Object.keys(linkedContacts)
  
      const filteredContactId = filteredContactIds[i]
      const linkedContactId = linkedContactIds[i]
  
      const filteredContact = filteredContacts[filteredContactId]
      const linkedContact = linkedContacts[linkedContactId]
  
      rows.push(

        <Row 
          className="alternate-1 p-2"
          key={i}
        >

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

    )
    }
  
    return rows
  }  

  const toggleContacts = () => setShowContacts(!showContacts)

  const toggleEditor = () => setShowEditor(!showEditor)

  const toggleSettings = () => setShowSettings(!showSettings)

  const updateList = async () => {

    toggleDimmer(true)
    const listIdPresent = validateUUID(getValues('listId'))
    await getAllLists()
    setShowSettings(!validateUUID(listIdPresent)) 
    
    if (listIdPresent === true) { await getListData() } else { setShowContacts(false) }

    toggleDimmer(false)

  }

  useEffect(() => {

    const context = `${nowRunning}.useEffect`

    const runThis = async () => {

      try {

        if (!loading) {

          setLoading(true) // only do this once!          
          toggleDimmer(true)
          await getAllContacts()
          await getAllLists()

          if (lists.length > 0) setShowSettings(true)

          setLoaded(true)
          toggleDimmer(false)

        }

      } catch (e) {

        if (level === 9) console.log(`exception: ${e.message}`)
  
        toggleDimmer(false)
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

    runThis()

  }, [getAllContacts, getAllLists, level, lists.length, loading, toggleDimmer])

  try {
    
    // setup for error display and (possible) reporting

    let reportError = false; // default condition is there is no error
    const {
      alreadyReported,
      context,
      details,
      message: errorMessage,
      errorNumber,
      occurred: errorOccurred
    } = errorState

    if (errorOccurred && !alreadyReported) reportError = true; // persist this error to the Simplexable API

    // final setup before rendering

    if (+level === 9 && Object.keys(errors).length > 0) console.log('validation errors: ', errors)

    const locked = listData?.locked // is the form data locked?

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
                  overlay={ (props) => (
                    <Tooltip { ...props }>
                      create new lists
                    </Tooltip>
                )}
                  placement="bottom"
                >

                  <a href="./new"><PlusSquare /></a>
                  
                </OverlayTrigger>

              </div>

              <div className="float-right ml-05">

                <OverlayTrigger
                  delay={ {  hide: 100, show: 200 } }
                  overlay={ (props) => (
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
                      overlay={ (props) => (
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
                      overlay={ (props) => (
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
                    onChange={ () => { updateList() } }
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
                onSubmit={handleSubmit(onSubmit)}
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

                  <Col xs={12} sm={6}>

                    <Form.Label className="mb-3 size-65 text-muted">list options</Form.Label>

                    <div className="floats">

                      <div className="float-left mr-05">

                        <CheckBoxInput
                          disabled={ locked > level }
                          inputName="acceptContacts"
                          label="allow new contacts"
                          register={register}
                        />

                      </div>

                      <div className="float-left mr-05">

                        <CheckBoxInput
                          disabled={ locked > level }
                          inputName="active"
                          label="active"
                          register={register}
                        />

                      </div>

                      <div className="float-left mr-05">

                        <CheckBoxInput
                          disabled={ locked > level }
                          inputName="locked"
                          label="locked"
                          register={register}
                        />

                      </div>
                    
                    </div>

                  </Col>

                </Row>

                <TextArea
                  disabled={ locked > level }
                  inputName="listNotes"
                  label="notes"
                  placeholder="use this to add notes about the list..."
                  register={register}
                />

                {level >= locked && (

                  <FormButtons
                    deleteMessage="Are you sure you want to delete this list?"
                    deletePrompt="delete list"
                    errors={errors}
                    onReset={onReset}
                    showConfirmationModal={showConfirmationModal}
                    showDelete={true}
                    submitText="update the expense"
                  />

                )}

                <DeleteConfirmationModal 
                  confirmModal={onDelete}
                  hideModal={hideConfirmationModal}
                  message="Are you sure you want to remove this mailing list?"
                  showModal={showModal} 
                />

              </Form>

          )}

            {showContacts && listData?.listName && (

              <>


                <div className="bg-light p-3 mb-3">

                  <div className="mb-3 size-80"><b>{listData.listName} contacts ({linkedContactsCount})</b></div>
                    
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

    if (level === 9) console.log(`exception: ${e.message}`)

    toggleDimmer(false)
    setErrorState(prevState => ({
      ...prevState,
      context: nowRunning,
      details: e.message,
      errorAlreadyReported: false,
      occurred: true
    }))

  }

}

export default ManageLists;