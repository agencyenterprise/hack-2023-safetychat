import { IconArrowDown, IconClearAll, IconSettings } from '@tabler/icons-react';
import {
  MutableRefObject,
  memo,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useTranslation } from 'next-i18next';

import { useChatModeRunner } from '@/hooks/chatmode/useChatModeRunner';
import useConversations from '@/hooks/useConversations';

import { DEFAULT_SYSTEM_PROMPT } from '@/utils/app/const';
import { throttle } from '@/utils/data/throttle';

import { Plugin } from '@/types/agent';
import { ChatBody, Conversation, Message } from '@/types/chat';
import { ChatMode } from '@/types/chatmode';

import HomeContext from '@/pages/api/home/home.context';

import Spinner from '../Spinner';
import { ChatInput } from './ChatInput';
import { ChatLoader } from './ChatLoader';
import { ErrorMessageDiv } from './ErrorMessageDiv';
import { MemoizedChatMessage } from './MemoizedChatMessage';
import { ModelSelect } from './ModelSelect';
import { SystemPrompt } from './SystemPrompt';
import { TemperatureSlider } from './Temperature';

interface Props {
  stopConversationRef: MutableRefObject<boolean>;
}

export const Chat = memo(({ stopConversationRef }: Props) => {
  const { t } = useTranslation('chat');

  const {
    state: {
      selectedConversation,
      models,
      apiKey,
      chatModeKeys: chatModeKeys,
      serverSideApiKeyIsSet,
      modelError,
      loading,
      prompts,
      settings,
    },
  } = useContext(HomeContext);
  const [conversations, conversationsAction] = useConversations();

  const [currentMessage, setCurrentMessage] = useState<Message>();
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showScrollDownButton, setShowScrollDownButton] =
    useState<boolean>(false);
  const [systemPrompt, setSystemPrompt] = useState<string>(
    t(DEFAULT_SYSTEM_PROMPT) || '',
  );
  const [temperature, setTemperature] = useState<number>(
    settings.defaultTemperature,
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatModeSelector = useChatModeRunner(
    conversations,
    stopConversationRef,
  );

  const handleSend = useCallback(
    async (
      message: Message,
      deleteCount = 0,
      chatMode: ChatMode | null = null,
      plugins: Plugin[],
    ) => {
      if (!selectedConversation) {
        return;
      }
      const conversation = selectedConversation;
      if (
        conversation.prompt !== systemPrompt ||
        conversation.temperature !== temperature
      ) {
        conversation.prompt = systemPrompt;
        conversation.temperature = temperature;
        await conversationsAction.update(conversation);
      }

      let updatedConversation: Conversation;
      if (deleteCount) {
        const updatedMessages = [...conversation.messages];
        for (let i = 0; i < deleteCount; i++) {
          updatedMessages.pop();
        }
        updatedConversation = {
          ...conversation,
          messages: [...updatedMessages, message],
        };
      } else {
        updatedConversation = {
          ...conversation,
          messages: [...conversation.messages, message],
        };
      }
      const chatBody: ChatBody = {
        model: updatedConversation.model,
        messages: updatedConversation.messages,
        key: apiKey,
        prompt: conversation.prompt,
        temperature: conversation.temperature,
      };
      const chatModeRunner = chatModeSelector(chatMode);
      chatModeRunner.run({
        body: chatBody,
        conversation: updatedConversation,
        message,
        selectedConversation,
        plugins,
      });
    },
    [
      selectedConversation,
      systemPrompt,
      temperature,
      conversationsAction,
      apiKey,
      chatModeSelector,
    ],
  );

  const scrollToBottom = useCallback(() => {
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      textareaRef.current?.focus();
    }
  }, [autoScrollEnabled]);

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        chatContainerRef.current;
      const bottomTolerance = 30;

      if (scrollTop + clientHeight < scrollHeight - bottomTolerance) {
        setAutoScrollEnabled(false);
        setShowScrollDownButton(true);
      } else {
        setAutoScrollEnabled(true);
        setShowScrollDownButton(false);
      }
    }
  };

  const handleScrollDown = () => {
    chatContainerRef.current?.scrollTo({
      top: chatContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  };

  const handleSettings = () => {
    setShowSettings(!showSettings);
  };

  const onClearAll = () => {
    if (
      confirm(t<string>('Are you sure you want to clear all messages?')) &&
      selectedConversation
    ) {
      conversationsAction.updateValue(selectedConversation, {
        key: 'messages',
        value: [],
      });
    }
  };

  const scrollDown = () => {
    if (autoScrollEnabled) {
      messagesEndRef.current?.scrollIntoView(true);
    }
  };

  useEffect(() => {
    setSystemPrompt(
      selectedConversation?.prompt ||
        t(DEFAULT_SYSTEM_PROMPT) ||
        DEFAULT_SYSTEM_PROMPT,
    );
    setTemperature(settings.defaultTemperature);
  }, [selectedConversation, settings.defaultTemperature, t]);

  const throttledScrollDown = throttle(scrollDown, 250);
  useEffect(() => {
    throttledScrollDown();
    selectedConversation &&
      setCurrentMessage(
        selectedConversation.messages[selectedConversation.messages.length - 2],
      );
  }, [selectedConversation, throttledScrollDown]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setAutoScrollEnabled(entry.isIntersecting);
        if (entry.isIntersecting) {
          textareaRef.current?.focus();
        }
      },
      {
        root: null,
        threshold: 0.5,
      },
    );
    const messagesEndElement = messagesEndRef.current;
    if (messagesEndElement) {
      observer.observe(messagesEndElement);
    }
    return () => {
      if (messagesEndElement) {
        observer.unobserve(messagesEndElement);
      }
    };
  }, [messagesEndRef]);

  return (
    <div className="relative flex-1 overflow-hidden bg-white dark:bg-[#343541]">
      {!(apiKey || serverSideApiKeyIsSet) ? (
        <div className="mx-auto flex h-full w-[300px] flex-col justify-center space-y-6 sm:w-[600px]">
          <div className="text-center text-4xl font-bold text-black dark:text-white">
            Welcome to Chatbot UI
          </div>
          <div className="text-center text-lg text-black dark:text-white">
            <div className="mb-8">{`Smart Chatbot UI is an open source clone of OpenAI's ChatGPT UI.`}</div>
            <div className="mb-2 font-bold">
              Important: Chatbot UI is 100% unaffiliated with OpenAI.
            </div>
          </div>
          <div className="text-center text-gray-500 dark:text-gray-400">
            <div className="mb-2">
              Chatbot UI allows you to plug in your API key to use this UI with
              their API.
            </div>
            <div className="mb-2">
              It is <span className="italic">only</span> used to communicate
              with their API.
            </div>
            <div className="mb-2">
              {t(
                'Please set your OpenAI API key in the bottom left of the sidebar.',
              )}
            </div>
            <div>
              {t("If you don't have an OpenAI API key, you can get one here: ")}
              <a
                href="https://platform.openai.com/account/api-keys"
                target="_blank"
                rel="noreferrer"
                className="text-blue-500 hover:underline"
              >
                openai.com
              </a>
            </div>
          </div>
        </div>
      ) : modelError ? (
        <ErrorMessageDiv error={modelError} />
      ) : (
        <>
          <div
            className="max-h-full overflow-x-hidden"
            ref={chatContainerRef}
            onScroll={handleScroll}
          >
            {selectedConversation?.messages.length === 0 ? (
              <>
                <div className="mx-auto flex flex-col space-y-5 md:space-y-10 px-3 pt-5 md:pt-12 sm:max-w-[600px]">
                    <center><a href="https://www.ae.studio"> <img src="https://avatars.githubusercontent.com/u/831220?s=200&v=4" alt="AE Studio logo" height='80' width='80'></img></a></center>
                    <div className="text-center text-3xl font-semibold text-gray-800 dark:text-gray-100">
                      {models.length === 0 ? (
                        <div>
                          <Spinner size="16px" className="mx-auto" />
                        </div>
                      ) : (
                        'SafetyChat'
                      )}
                    </div>
                    <div className="px-1 pt-1 pb-1 text-center text-[12px] text-black/50 dark:text-white/50 md:px-2 md:pt-2 md:pb-2">
                      Created using {' '} 
                      <a
                          href="https://github.com/dotneet/smart-chatbot-ui"
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                      >
                      Smart ChatBot UI
                      </a>
                    </div>
                  {models.length > 0 && (
                    <div className="flex h-full flex-col space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-600">
                      <ModelSelect />

                      <SystemPrompt
                        conversation={selectedConversation}
                        systemPrompt={systemPrompt}
                        prompts={prompts}
                        onChangePrompt={(prompt) => setSystemPrompt(prompt)}
                      />

                      <label className="mb-2 text-left text-neutral-700 dark:text-neutral-400">
                        {t('Temperature')}
                      </label>

                      <TemperatureSlider
                        onChangeTemperature={(temperature) =>
                          setTemperature(temperature)
                        }
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="sticky top-0 z-20 bg-neutral-100 text-neutral-500 dark:bg-[#444654] dark:text-neutral-200">
                  <div className="flex justify-center border border-b-neutral-300 bg-neutral-100 py-2 text-sm text-neutral-500 dark:border-none dark:bg-[#444654] dark:text-neutral-200">
                    {selectedConversation?.name}
                    <button
                      className="ml-2 cursor-pointer hover:opacity-50"
                      onClick={handleSettings}
                    >
                      <IconSettings size={18} />
                    </button>
                    <button
                      className="ml-2 cursor-pointer hover:opacity-50"
                      onClick={onClearAll}
                    >
                      <IconClearAll size={18} />
                    </button>
                  </div>
                  {showSettings && (
                    <div className="flex flex-col space-y-10 md:mx-auto md:max-w-xl md:gap-6 md:py-3 md:pt-6 lg:max-w-2xl lg:px-0 xl:max-w-3xl">
                      <div className="flex h-full flex-col space-y-4 border-b border-neutral-200 p-4 dark:border-neutral-600 md:rounded-lg md:border">
                        <ModelSelect />
                      </div>
                    </div>
                  )}
                </div>

                {selectedConversation?.messages.map((message, index) => (
                  <MemoizedChatMessage
                    key={index}
                    message={message}
                    messageIndex={index}
                  />
                ))}

                {loading && <ChatLoader />}

                <div
                  className="h-[210px] bg-white dark:bg-[#343541]"
                  ref={messagesEndRef}
                />
              </>
            )}
          </div>

          <ChatInput
            stopConversationRef={stopConversationRef}
            textareaRef={textareaRef}
            onSend={(message, chatMode, plugins) => {
              setCurrentMessage(message);
              handleSend(message, 0, chatMode, plugins);
            }}
            onRegenerate={(chatMode, plugins) => {
              if (currentMessage) {
                handleSend(currentMessage, 2, chatMode, plugins);
              }
            }}
          />
        </>
      )}
      {showScrollDownButton && (
        <div className="absolute bottom-0 right-0 mb-4 mr-4 pb-20">
          <button
            className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-300 text-gray-800 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-neutral-200"
            onClick={handleScrollDown}
          >
            <IconArrowDown size={18} />
          </button>
        </div>
      )}
    </div>
  );
});
Chat.displayName = 'Chat';
