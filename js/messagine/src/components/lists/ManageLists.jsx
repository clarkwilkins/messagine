import { 
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Joi from 'joi';
import { joiResolver } from '@hookform/resolvers/joi';
import moment from 'moment';
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
  Gear,
  List,
  PlusSquare,
  UserGear
} from '@phosphor-icons/react';
import CheckBoxInput from '../common/CheckBoxInput';
import DeleteConfirmationModal from '../common/DeleteConfirmationModal';
import ErrorBoundary from '../common/ErrorBoundary';
import FormButtons from '../common/FormButtons';
import Loading from '../common/Loading';
import Selector from '../common/Selector';
import TextArea from '../common/TextArea';
import TextInput from '../common/TextInput';
import apiLoader from '../../services/apiLoader';
import useLoadingMessages from '../hooks/useLoadingMessages';
import { 
  changeTitle,
  validateUUID
} from '../../services/utils';

function ManageListsComponent({ handleError }) {

  const nowRunning = 'lists/ManageLists.jsx';
  changeTitle ('messagine: lists management');

  const [state, setState] = useState({
    availableContacts: {}, // The space of every active and unblocked contact.
    eligibleContacts: {}, // The space of all available contacts that can be linked to this list.
    linkedContacts: {}, // The space of all available contacts that are linked to this list.
    linkedContactsCount: 0,
    listData: {},
    lists: {},
    loaded: false,
    showContacts: false,
    showEditor: false,
    showModal: false,
    showSettings: true
  });

  const {
    availableContacts,
    eligibleContacts,
    linkedContacts,
    linkedContactsCount,
    listData,
    lists,
    loaded,
    showContacts,
    showEditor,
    showModal,
    showSettings
  } = state;
  const [scrollTarget, setScrollTarget] = useState(null); // Track which contact to scroll to

  const { 
    level,
    setLoadingMessages,
    userId 
  } = useOutletContext();
  
  const { 
    addLoadingMessage, 
    removeLoadingMessage 
  } = useLoadingMessages(setLoadingMessages);

  const schema = Joi.object({
    acceptContacts: Joi.boolean().optional(),
    active: Joi.boolean().optional(),
    apiTesting: Joi.boolean().optional(),
    listId: Joi.string().required().uuid(),
    listName: Joi.string().required(),
    listNotes: Joi.string().optional().allow('', null),
    locked: Joi.boolean().optional().allow('', null)
  });

  const { 
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    reset,
    setValue,
    trigger
  } = useForm({ resolver: joiResolver(schema) });

  const getAllContacts = useCallback(async () => {

    const context = `${nowRunning}.getAllContacts`;

    try {
      const api = 'contacts/all';
      const payload = { active: true };
      const { data } = await apiLoader({ api, payload });
      const { 
        availableContacts, 
        failure, 
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

      setState(prevState => ({
        ...prevState,
        availableContacts
      }));

    } catch (error) {

      handleError({ 
        error, 
        nowRunning: context, 
        userId 
      });

    }

  }, [handleError, userId]);

  const getAllLists = useCallback(async () => {

    const context = `${nowRunning}.getAllLists`;

    try {
      const api = 'lists/all';
      const payload = {};
      const { data } = await apiLoader({ api, payload });
      const { 
        allLists: lists,
        failure, 
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

      setState(prevState => ({
        ...prevState,
        lists
      }));

    } catch (error) {

      handleError({ 
        error, 
        nowRunning: context, 
        userId 
      });
    }

  }, [handleError, userId]);

  const getListData = async () => {

    const context = `${nowRunning}.getListData`;

    try {

      setValue('listName', null);
      setState(prevState => ({ 
        ...prevState, 
        listData: {},
        showEditor: false
      }));

      const { listId } = getValues();

      if (!listId) {

        setState(prevState => ({
          ...prevState,
          linkedContacts: {},
          linkedContactsCount: 0,
          listData: {},
          showEditor: false
        }));
        return;

      }

      const api = 'lists/load';
      const payload = { listId };
      const { data } = await apiLoader({ api, payload });
      const {
        acceptContacts,
        active,
        failure,
        linkedContacts,
        listName,
        listNotes,
        locked,
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

      // Remove already linked contacts from available contacts.

      const eligibleContacts = { ...availableContacts };

      Object.keys(linkedContacts).forEach(contactId => { delete eligibleContacts[contactId]; });

      setState(prevState => ({
        ...prevState,
        eligibleContacts,
        linkedContacts,
        linkedContactsCount: Object.keys(linkedContacts).length,
        listData: data,
        showContacts: true
      }));
      setValue('acceptContacts', acceptContacts);
      setValue('active', active);
      setValue('listName', listName);
      setValue('listNotes', listNotes);
      setValue('locked', locked >= level);

    } catch (error) {

      handleError({ 
        error, 
        nowRunning: context, 
        userId 
      });

    }

  };

  const hideConfirmationModal = () => {

    setState(prevState => ({ 
      ...prevState, 
      showModal: false 
    }));

  };

  const manageLink = async (contactId, link) => {

    const context = `${nowRunning}.manageLink`;
  
    try {

      const api = 'lists/contact-linking';
      const payload = { contactId, link, listId: getValues().listId };
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
        return null;

      }
  
      await getListData(); // Refresh eligible and linked contacts
      setScrollTarget(contactId); // Set the target to scroll to

    } catch (error) {

      handleError({ 
        error, 
        nowRunning: context, 
        userId 
      });

    }

  };

  const onChange = () => { trigger(); };

  const onDelete = async () => {

    const context = `${nowRunning}.onDelete`;
    const loadingMessage = 'deleting the mailing list...';

    try {

      addLoadingMessage(loadingMessage);
      const { listId } = getValues();
      const api = 'lists/delete';
      const payload = { listId };
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
        return null;

      }

      setState(prevState => ({
        ...prevState,
        linkedContacts: {},
        linkedContactsCount: 0,
        listData: {},
        showEditor: false
      }));
      setValue('listId', null);
      await updateList();
      reset();
      toast.success('The mailing list was deleted.');
      removeLoadingMessage(loadingMessage);

    } catch (error) {

      handleError({ 
        error, 
        nowRunning: context, 
        userId 
      });

    }

  };

  const onReset = async () => {

    await getListData();
    setState(prevState => ({ 
      ...prevState, 
      showEditor: true 
    }));

  };

  const onSubmit = async () => {

    const context = `${nowRunning}.onSubmit`;
    const loadingMessage = 'updating the mailing list...';

    try {

      addLoadingMessage(loadingMessage);
      const api = 'lists/update';
      const payload = { ...getValues() };
      const { data } = await apiLoader({ api, payload });
      const { 
        failure, 
        success } = data;

      if (!success) {

        handleError({ 
          failure, 
          nowRunning: context, 
          userId 
        });
        return null;

      }

      await getListData();
      await getAllLists();
      toast.success('The list setup was updated.');
      removeLoadingMessage(loadingMessage);

    } catch (error) {

      handleError({ 
        error, 
        nowRunning: context, 
        userId
      });

    }

  };
  

  const showConfirmationModal = () => {

    setState(prevState => ({ 
      ...prevState, 
      showModal: true 
    }));

  };

  const toggleContacts = () => {

    setState(prevState => ({ 
      ...prevState, 
      showContacts: !showContacts 
    }));

  };

  const toggleEditor = () => {

    setState(prevState => ({ 

      ...prevState, 
      showEditor: !showEditor 
    }));

  };

  const toggleSettings = () => {

    setState(prevState => ({ 
      ...prevState, 
      showSettings: !showSettings 
    }));

  };

  const updateList = async () => {
    
    const context = `${nowRunning}.updateList`;
    const loadingMessage = 'loading the mailing list...';

    try {

      addLoadingMessage(loadingMessage);
      const listIdPresent = validateUUID(getValues('listId'));
      await getAllLists();
      setState(prevState => ({ 
        ...prevState, 
        showSettings: !validateUUID(listIdPresent) 
      }));

      if (listIdPresent === true) {

        await getListData();

      } else {

        setState(prevState => ({ 
          ...prevState, showContacts: false }));
      }

      removeLoadingMessage(loadingMessage);

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
    const loadingMessage = 'loading setup data...';

    const runThis = async () => {

      try {

        if (!loaded) {

          setState(prevState => ({ 
            ...prevState, 
            loaded: true 
          }));
          addLoadingMessage(loadingMessage);
          await getAllContacts();
          await getAllLists();

          if (lists.length2 > 0) {

            setState(prevState => ({ 
              ...prevState, 
              showSettings: true 
            }));

          }

          removeLoadingMessage(loadingMessage);

        }

      } catch (error) {

        handleError({ 
          error, 
          nowRunning: context, 
          userId });

      }

    };

    runThis();

  }, [addLoadingMessage, getAllContacts, getAllLists, handleError, loaded, lists, removeLoadingMessage, userId]);



  // Use useEffect to scroll when the scrollTarget changes. This will scroll to the row with the contact that was just linked or unlinked.

  useEffect(() => {

    if (scrollTarget) {

      const row = contactRefs.current[scrollTarget];
    
      if (row) { // Scroll to this row.

        row.scrollIntoView({ behavior: 'smooth', block: 'center' });

      }

      setScrollTarget(null); // Reset scroll target after scrolling.

    }
  }, [scrollTarget]);


  const contactRefs = useRef({}); // Store references to all rows

  try {

    const locked = listData?.locked; // is the form data locked?

    return (

      <>

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
                  delay={{ hide: 100, show: 200 }}
                  overlay={(props) => (
                    <Tooltip {...props}>create new lists</Tooltip>
                  )}
                  placement="bottom"
                >
                  <a href="./new"><PlusSquare /></a>
                </OverlayTrigger>
              </div>

              <div className="float-right ml-05">
                <OverlayTrigger
                  delay={{ hide: 100, show: 200 }}
                  overlay={(props) => (
                    <Tooltip {...props}>
                      {showSettings && (<span>hide lists</span>)}
                      {!showSettings && (<span>show lists</span>)}
                    </Tooltip>
                  )}
                  placement="bottom"
                >
                  <div onClick={() => toggleSettings()}><List /></div>
                </OverlayTrigger>
              </div>

              {listData && (
                <>
                  <div className="float-right ml-05">
                    <OverlayTrigger
                      delay={{ hide: 100, show: 200 }}
                      overlay={(props) => (
                        <Tooltip {...props}>
                          {showEditor && (<span>hide editor</span>)}
                          {!showEditor && (<span>show editor</span>)}
                        </Tooltip>
                      )}
                      placement="bottom"
                    >
                      <div onClick={() => toggleEditor()}><Gear /></div>
                    </OverlayTrigger>
                  </div>

                  <div className="float-right ml-05">
                    <OverlayTrigger
                      delay={{ hide: 100, show: 200 }}
                      overlay={(props) => (
                        <Tooltip {...props}>
                          {showContacts && (<span>hide contacts</span>)}
                          {!showContacts && (<span>show contacts</span>)}
                        </Tooltip>
                      )}
                      placement="bottom"
                    >
                      <div onClick={() => toggleContacts()}><UserGear /></div>
                    </OverlayTrigger>
                  </div>
                </>
              )}

              mailing lists
            </h5>

            {showSettings && (

              <div className="bg-light p-3 mb-3">
                <Selector
                  inputName="listId"
                  label="mailing list"
                  onChange={() => { updateList(); }}
                  placeholder="please select a list to continue..."
                  register={register}
                  values={lists}
                />
              </div>

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
                      disabled={locked > level}
                      errors={errors.listName}
                      inputName="listName"
                      label="list name"
                      onChange={onChange}
                      placeholder="the list name cannot be empty"
                      register={register}
                    />
                  </Col>

                  <Col xs={12} sm={6}>

                    <div className="mb-3 size-65 text-muted">list options</div>

                    <div className="floats">

                      <div className="float-left mr-05">
                        <CheckBoxInput
                          disabled={locked > level}
                          inputName="acceptContacts"
                          label="allow new contacts"
                          register={register}
                        />
                      </div>

                      <div className="float-left mr-05">
                        <CheckBoxInput
                          disabled={locked > level}
                          inputName="active"
                          label="active"
                          register={register}
                        />
                      </div>

                      <div className="float-left mr-05">
                        <CheckBoxInput
                          disabled={locked > level}
                          inputName="locked"
                          label="locked"
                          register={register}
                        />
                      </div>

                    </div>

                  </Col>

                </Row>

                <TextArea
                  disabled={locked > level}
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
                    submitText="update the list"
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

              <div className="bg-light p-3 mb-3">

                <div className="mb-3 size-80"><b>{listData.listName} contacts ({linkedContactsCount})</b></div>

                <Row>

                  <Col className="pr-1">
                  
                    <Container className="border-gray-2 p-0 size-80">
                      
                      <div className="p-1">in use ({Object.keys(linkedContacts).length})</div>

                      {Object.entries(linkedContacts).map((row, key) => {

                        const [contactId, contactData] = row;
                        const { 
                          contactNotes,
                          email,
                          fullName,
                          updated
                        } = contactData;

                        return (

                          <div 
                            className="alternate-1 p-3 hover"
                            key={key}
                            onClick={() => { manageLink(contactId, false); }}
                            ref={(el) => (contactRefs.current[contactId] = el)} // Store reference to this row.
                          >
                            <div><b>{fullName}</b></div>
                            <div>{email}</div>
                            <div className="size-80">{contactNotes}</div>
                            <div className="size-65">last updated {updated}</div>
                          </div>

                        );
                        
                      })};

                    </Container>

                  </Col>

                  <Col className="pr-1">
                  
                   <Container className="border-gray-2 p-0 size-80">

                      <div className="p-1">eligible ({Object.keys(eligibleContacts).length})</div>

                      {Object.entries(eligibleContacts).map((row, key) => {

                        const [contactId, contactData] = row;
                        const { 
                          contactNotes,
                          email,
                          fullName,
                          updated
                        } = contactData;

                        return (

                          <div 
                            className="alternate-1 p-3 hover"
                            key={key}
                            onClick={() => { manageLink(contactId, true); }}
                            ref={(el) => (contactRefs.current[contactId] = el)} // Store reference to this row.
                          >
                            <div><b>{fullName}</b></div>
                            <div>{email}</div>
                            <div className="size-80">{contactNotes}</div>
                            <div className="size-65">last updated {moment.unix(updated).format('YYYY.MM.DD')}</div>
                          </div>

                        );
                        
                      })};

                    </Container>

                  </Col>

                </Row>
                
              </div>

            )}

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

export default function ManageLists(props) {

  const defaultProps = {
    ...props,
    defaultError: "The list manager isn't working right now",
    errorNumber: 50
  };

  return (

    <ErrorBoundary
      context="lists/ManageLists.jsx"
      defaultError={defaultProps.defaultError}
      errorNumber={defaultProps.errorNumber}
    >
      <ManageListsComponent {...defaultProps} />
    </ErrorBoundary>

  );
}