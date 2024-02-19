import { 
  useCallback,
  useEffect,
  useState
} from 'react'
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
  Check,
  List 
} from '@phosphor-icons/react'
import CheckBoxInput from '../common/CheckBoxInput'
import FormButtons from '../common/FormButtons'
import TextArea from '../common/TextArea'
import TextInput from '../common/TextInput'
import { 
  apiLoader, 
  changeTitle,
  errorDisplay,
  recordEvent,
  stringCleaner
} from '../../services/handler'

function NewContact() {

  const nowRunning = 'contacts/NewContact.jsx'
  changeTitle ('messagine: new contact')

  const defaultError = "The new contact tool isn't working right now"
  const [errorState, setErrorState] = useState({
    alreadyReported: false,
    context: '',
    details: 'general exception thrown',
    displayed: 57, // This is only useful when there are child components.
    message: defaultError,
    number: 57,
    occurred: false,
  })
  const {
    level,
    toggleDimmer
  } = useOutletContext()
  const [lists, setLists] = useState({})
  const [listTargets, setListTargets] = useState([])
  const [loading, setLoading] = useState() // This is used to load active mailing lists just one time (useEffect).
  const schema = Joi.object({
    companyName: Joi.string().optional().allow( '', null ),
    contactName: Joi.string().required(),
    contactNotes: Joi.string().optional().allow( '', null ),
    email: Joi.string().required(),
    locked: Joi.boolean(),
    sms: Joi.string().optional().allow( '', null ),
    url: Joi.string().optional().allow( '', null )
  })

  const { 
    formState: { errors },
    handleSubmit,
    register,
    reset,
    trigger
  } = useForm({ resolver: joiResolver(schema)})

  // Get all active lists that are accepting new contacts.

  const getAllLists = useCallback(async () => {

    const context = `${nowRunning}.getAllLists`

    try {

      toggleDimmer(true)
      const api = 'lists/all'
      const payload = { active: true }
      const { data } = await apiLoader({ api, payload })
      const {
        failure,
        lists,
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

      console.log('lists', lists)
      const availableLists = {}

      Object.entries(lists).map(list => {

        const {
          acceptContacts,
          listName,
          listNotes
        } = list[1]

        if (acceptContacts == true) { 

          availableLists[list[0]] = {
            listName,
            listNotes
          }

        }

      })

      setLists(availableLists)
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

  // Display all lists that are accepting new contacts and include a check mark on lists which will be adding this contact.

  const listsDisplay = () => {

    const context = `${nowRunning}.listsDisplay`

    const rows = Object.entries(lists).map((list, key) => {

      const listId=list[0]
      const {
        listName,
        listNotes
      } = list[1]

      return (

        <Row
          className="alternate-1 p-3 hover"
          key={key}
          onClick={ () => toggleList(listId)}
        >
          
          <div>{listName}{listTargets.includes(listId) && (<span className = "ml-05 up-3 size-125"><b><Check /></b></span>)}</div>
          <div className="size-80">{listNotes}</div>

        </Row>
      )

    })

    return rows

  }

  const onReset = () => {
    
    reset()
    trigger()

  }

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`

    try {

      toggleDimmer(true)
      const api = 'contacts/new'
      const payload = { ...data }
      payload.contactName = stringCleaner(payload.contactName, true)
      payload.contactNotes = stringCleaner(payload.contactNotes, true)
      payload.email = stringCleaner(payload.email, true)
      payload.sms = stringCleaner(payload.sms, true)
      payload.url = stringCleaner(payload.url, true)
      const { data: result } = await apiLoader({ api, payload })
      const {
        contactId,
        failure,
        success
      } = result
      
      if (!success) {

        if (+level === 9) console.log(`failure: ${failure}`)
    
        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          alreadyReported: true,
          context,
          message: `failure: ${failure}`,
          occurred: true
        }))
        return null
    
      }

      await recordEvent ({ eventNumber: 12, eventTarget: contactId })  // Record contact created event.

      // Define the function that actually does the contact:list linking.

      async function addToList({ contactId, listId }) {

        const api = 'lists/contact-linking'
        const payload = {
          contactId,
          link: true,
          listId
        }
        const { data } = await apiLoader({ api, payload })

        const {
          failure,
          success
        } = data
        
        if (!success) {
  
          if (+level === 9) console.log(`failure: ${failure}`)
      
          toggleDimmer(false)
          setErrorState(prevState => ({
            ...prevState,
            alreadyReported: true,
            context,
            message: `failure: ${failure}`,
            occurred: true
          }))
          return { failure, success: false}
      
        }

        // Record adding this contact to a mailing list.

        await recordEvent ({ eventNumber: 13, eventDetails: 'contact added to list ' + lists[listId].listName, eventTarget: contactId })

        return { success: true }

      }

      // Define the function to run the async operation on all members of listTargets.

      async function processListTargets(listTargets) {

        const promises = listTargets.map(async (listId) => { return await addToList({ listId, contactId }) })      
        const results = await Promise.all(promises);
        return results

      }

      // Add the contact to any selected lists.
      
      processListTargets(listTargets)
        .then(results => {
          console.log(results); // Logs the result of the async operation for each array element
        })
        .catch(error => {
          console.error(error); // Handles any errors that might occur during the async operations
        })

      toast.success('The new contact was created.')
      onReset()
      toggleDimmer(false)

    } catch(e) {

      if (+level === 9) console.log(`exception: ${e.message}`)

      toggleDimmer(false)
      setErrorState(prevState => ({
        ...prevState,
        context,
        details: e.message,
        alreadyReported: false,
        occurred: true
      }))

    }

  }

  // Add or remove a list that will be adding this contact.

  const toggleList = listId => {

    if (listTargets.includes(listId)) {

      let filteredArray = listTargets.filter(function(element) { return element !== listId } )
      setListTargets(filteredArray)


    } else {

      listTargets.push(listId)
      setListTargets(listTargets)

    }

    trigger()
    
  }

  // Load active mailing lists once, but check form validation every time.

  useEffect(() => { 

    const context = `${nowRunning}.useEffect`

    const runThis = async () => {

      try {

        if (!loading) {

          setLoading(true) // Only do this once!          
          toggleDimmer(true)
          await getAllLists()
          toggleDimmer(false)

        }

        trigger()

      } catch (e) {

        if (+level === 9) console.log(`exception: ${e.message}`)
  
        toggleDimmer(false)
        setErrorState(prevState => ({
          ...prevState,
          context,
          details: e.message,
          errorAlreadyReported: false,
          occurred: true
        }))
        setLoading(true)
      
      }

    }

    runThis()
  
  }, [trigger])

  try {
    
    // Setup for error display and (possible) reporting.

    let reportError = false // Default condition is there is no error.
    const {
      alreadyReported,
      context,
      details,
      message: errorMessage,
      errorNumber,
      occurred: errorOccurred
    } = errorState

    if (errorOccurred && !alreadyReported) reportError = true // Persist this error to the Simplexable API.

    // Final setup before rendering.

    if (+level === 9 && Object.keys(errors).length > 0) console.log('validation errors: ', errors)

    const availableListsCount = Object.keys(lists).length

    console.log(listTargets)

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
          
        <>

          <Breadcrumb className="size-50 text-muted mb-3">

            <Breadcrumb.Item>contacts</Breadcrumb.Item>
            <Breadcrumb.Item>new</Breadcrumb.Item>

          </Breadcrumb>

          <h5 className="floats">

            <div className="float-right ml-05">

              <OverlayTrigger
                delay={ {  hide: 100, show: 200 } }
                overlay={ (props) => (
                  <Tooltip { ...props }>
                    show contacts
                  </Tooltip>
             )}
                placement="bottom"
              >

                <a href="./manage"><List /></a>
                
              </OverlayTrigger>
              
            </div>
            
            new contact

          </h5>

          <Form 
            className="bg-light p-3 mb-3"
            onSubmit={handleSubmit(onSubmit)}
          >

            <Row>

              <Col xs={12} sm={6}>

                <TextInput
                  errors={errors.contactName}
                  inputName="contactName"
                  label="contact name"
                  onChange={ () => trigger() }
                  placeholder="contact name cannot be empty"
                  register={register}
                />

              </Col>

              <Col xs={12} sm={6}>

                <TextInput
                  inputName="companyName"
                  label="company name"
                  placeholder="company name is optional"
                  register={register}
                />

              </Col>

              <Col xs={12} sm={6}>

                <TextInput
                  errors={errors.email}
                  inputName="email"
                  label="email"
                  onChange={ () => trigger() }
                  placeholder="email address cannot be empty"
                  register={register}
                />

              </Col>

              <Col xs={12} sm={6}>

                <TextInput
                  inputName="sms"
                  label="sms"
                  placeholder="sms is optional"
                  register={register}
                />

              </Col>

              <Col xs={12} sm={6}>

                <TextInput
                  inputName="url"
                  label="sms"
                  placeholder="url is optional"
                  register={register}
                />

              </Col>
              
              <Col xs={12} sm={6}>

                <Form.Label className="size-65 text-muted">contact options</Form.Label>

                <div className="mt-3">

                  <CheckBoxInput
                    inputName="locked"
                    label="locked"
                    register={register}
                  />

                </div>

              </Col>

            </Row>

            <TextArea
                inputName="contactNotes"
                label="notes"
                placeholder="use this to add notes about the contact..."
                register={register}
            />            

            {availableListsCount > 0 && (

              <>

                <div className="size-65"><b>add to lists ({availableListsCount} available)</b></div>

                <Container className="border-gray-2 mt-3 mb-3 width-100 size-80">{listsDisplay()}</Container>

              </>

            )}

          <FormButtons
            errors={errors}
            onReset={onReset}
            submitText="create the contact"
          />

          </Form>

        </>

      </>

    )

  } catch(e) {

    if (+level === 9) console.log(`exception: ${e.message}`)

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

export default NewContact