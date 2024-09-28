import { 
  useCallback,
  useEffect,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import { toast } from 'react-toastify';
import { 
  Breadcrumb,
  Col,
  Container,
  Form,
  OverlayTrigger,
  Row,
  Tooltip
} from 'react-bootstrap';
import { 
  Check,
  List 
} from '@phosphor-icons/react';
import CheckBoxInput from '../common/CheckBoxInput';
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons';
import Loading from '../common/Loading';
import TextArea from '../common/TextArea';
import TextInput from '../common/TextInput';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import useRecordEvent from '../hooks/useRecordEvent';
import { 
  changeTitle,
  stringCleaner 
} from '../../services/utils';

function NewContactComponent({ handleError }) {

  const nowRunning = 'contacts/NewContact.jsx';
  changeTitle('messagine: new contact');

  const {
    setLoadingMessages,
    userId
  } = useOutletContext();
  
  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);

  const [state, setState] = useState({
    lists: {},
    listTargets: [],
    loaded: false
  });

  const { 
    lists, 
    listTargets, 
    loaded 
  } = state;

  const { recordEvent } = useRecordEvent();

  const schema = Joi.object({
    companyName: Joi.string().optional().allow('', null),
    contactName: Joi.string().required(),
    contactNotes: Joi.string().optional().allow('', null),
    email: Joi.string().required(),
    locked: Joi.boolean(),
    sms: Joi.string().optional().allow('', null),
    url: Joi.string().optional().allow('', null)
  });

  const { 
    formState: { errors },
    handleSubmit,
    register,
    reset,
    trigger
  } = useForm({ resolver: joiResolver(schema)});

  // Get all active lists that are accepting new contacts.

  const getAllLists = useCallback(async () => {

    const context = `${nowRunning}.getAllLists`;
    const loadingMessage = 'loading active mailing lists';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'lists/all';
      const payload = { active: true };
      const { data } = await apiLoader({ api, payload });
      const {
        failure,
        lists,
        success
      } = data;

      if (!success) {
    
        handleError({
          failure,
          nowRunning: context,
          userId
        });
        return null;
    
      }

      console.log('lists', lists);
      const availableLists = {};

      Object.entries(lists).forEach(list => {

        const {
          acceptContacts,
          listName,
          listNotes
        } = list[1];

        if (acceptContacts === true) { 

          availableLists[list[0]] = {
            listName,
            listNotes
          };

        }

      });

      setState((prevState) => ({
        ...prevState,
        lists: availableLists
      }));
      
      removeLoadingMessage(loadingMessage);
      return true;

    } catch(error) { 

      handleError({
        error,
        nowRunning: context,
        userId
      });
  
    }

  }, [addLoadingMessage, handleError, removeLoadingMessage, userId]);

  // Display all lists that are accepting new contacts and include a check mark on lists which will be adding this contact.

  const listsDisplay = () => {

    const context = `${nowRunning}.listsDisplay`;

    try {

      const rows = Object.entries(lists).map((list, key) => {

        const listId = list[0];
        const {
          listName,
          listNotes
        } = list[1];

        return (

          <Row
            className="alternate-1 p-3 hover"
            key={key}
            onClick={ () => toggleList(listId)}
          >
            
            <div>{listName}{listTargets.includes(listId) && (<span className = "ml-05 up-3 size-125"><b><Check /></b></span>)}</div>
            <div className="size-80">{listNotes}</div>

          </Row>
        );

      });

      return rows;

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  };

  const onReset = () => {
    
    reset();
    trigger();

  };

  const onSubmit = async data => {

    const context = `${nowRunning}.onSubmit`;
    const loadingMessage = 'creating the new contact';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'contacts/new';
      const payload = { ...data };
      payload.contactName = stringCleaner(payload.contactName, true);
      payload.contactNotes = stringCleaner(payload.contactNotes, true);
      payload.email = stringCleaner(payload.email, true);
      payload.sms = stringCleaner(payload.sms, true);
      payload.url = stringCleaner(payload.url, true);
      const { data: result } = await apiLoader({ api, payload });
      const {
        contactId,
        failure,
        success
      } = result;
      
      if (!success) {

        handleError({
          failure,
          nowRunning: context,
          userId
        });
        return null;
    
      }

      // Record contact created event.

      await recordEvent({ 
        eventNumber: 12, 
        eventTarget: contactId
      });

      // Define the function that actually does the contact:list linking.

      async function addToList({ contactId, listId }) {

        const api = 'lists/contact-linking';
        const payload = {
          contactId,
          link: true,
          listId
        };
        const { data } = await apiLoader({ api, payload });

        const {
          failure,
          success
        } = data;
        
        if (!success) {
  
          handleError({
            failure,
            nowRunning: context,
            userId
          });
          return { 
            failure, 
            success: false
          };
      
        }

        // Record adding this contact to a mailing list.

        await recordEvent ({ 
          eventNumber: 13, 
          eventDetails: `contact added to list ${lists[listId].listName}`, 
          eventTarget: contactId
        });

        return { success: true };

      }

      // Define the function to run the async operation on all members of listTargets.

      async function processListTargets(listTargets) {

        const promises = listTargets.map(async (listId) => { return await addToList({ listId, contactId }) });      
        const results = await Promise.all(promises);
        return results;

      }

      // Add the contact to any selected lists.
      
      processListTargets(listTargets)
        .then(results => {
          console.log(results); 
        })
        .catch(error => {
          console.error(error); 
        });

      toast.success('The new contact was created.');
      onReset();
      removeLoadingMessage(loadingMessage);

    } catch(error) {

      handleError({
        error,
        nowRunning: context,
        userId
      });

    }

  };

  // Add or remove a list that will be adding this contact.

  const toggleList = listId => {

    if (listTargets.includes(listId)) {

      let filteredArray = listTargets.filter(function(element) { return element !== listId });
      setState((prevState) => ({
        ...prevState,
        listTargets: filteredArray
      }));


    } else {

      listTargets.push(listId);
      setState((prevState) => ({
        ...prevState,
        listTargets
      }));

    }

    trigger();
    
  };

  // Load active mailing lists once, but check form validation every time.

  useEffect(() => { 

    const context = `${nowRunning}.useEffect`;

    const runThis = async () => {

      try {

        if (!loaded) {

          setState((prevState) => ({
            ...prevState,
            loaded: true
          }));
          
          await getAllLists();

        }

        trigger();

      } catch (error) {

        handleError({
          error,
          nowRunning: context,
          userId
        });
      
      }

    };

    runThis();
  
  }, [loaded, getAllLists, trigger, handleError, userId]);

  try {

    if (!loaded) {
      
      return <Loading message="loading new contact tool..." />;

    }

    const availableListsCount = Object.keys(lists).length;

    return (
    
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

              <div className="size-65 text-muted">contact options</div>

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

    );

  } catch(error) {

    handleError({
      error,
      nowRunning,
      userId
    });

  }

}

export default function NewContact(props) {

  const defaultProps = {
    ...props,
    defaultError: "The new contact tool isn't working right now.",
    errorNumber: 57
  };

  return (

    <ErrorBoundary
      context="NewContact.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <NewContactComponent {...defaultProps} />
    </ErrorBoundary>

  );

}
