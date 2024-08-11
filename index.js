"use strict";
(async () => {
    Element.prototype.hide = function () {
        this.style.display = 'none';
    };
    Element.prototype.show = function () {
        this.style.display = '';
    };
    Element.prototype.disable = function () {
        this.setAttribute('disabled', 'disabled');
    };
    Element.prototype.enable = function () {
        this.removeAttribute('disabled');
    };
    let openRequest = indexedDB.open("chatpdf", 2);
    let db = null;
    openRequest.onupgradeneeded = function () {
        const db = openRequest.result;
        if (!db.objectStoreNames.contains('conversations')) { // if there's no "books" store
            db.createObjectStore('conversations', { keyPath: 'id' }); // create it
        }
    };
    openRequest.onerror = function () {
        console.error("Error", openRequest.error);
    };
    openRequest.onsuccess = function () {
        db = openRequest.result;
        console.log("indexedDB initialized");
    };
    const DEFAULT_SCALE_DELTA = 1.10;
    const MIN_SCALE = 0.25;
    const MAX_SCALE = 2.5;
    const MIN_TEXTAREA_HEIGHT = 24;
    const MAX_TEXTAREA_HEIGHT = 280;
    const container = document.getElementById("viewerContainer");
    const landingPage = document.getElementById("landing");
    const loadingPage = document.getElementById("loadingPage");
    const statusBar = document.getElementById("pdfNav");
    const pdfInputs = document.getElementById("pdfInputs");
    const pdfControls = document.getElementById("pdfControls");
    const conversationContainer = document.getElementById("conversation-container");
    const conversationListContainer = document.getElementById("conversation-list");
    const conversationEmpty = document.getElementById("conversation-empty");
    const promptBarContainer = document.querySelector(".prompt-bar-container");
    const chatProviderSelect = document.getElementById("chatProvider");
    const chatModelSelect = document.getElementById("chatModel");
    const customChatProviderContainer = document.getElementById("customChatProviderContainer");
    const chatHostInput = document.getElementById("chatHost");
    const chatPortInput = document.getElementById("chatPort");
    const chatApiKey = document.getElementById("chatApiKey");
    const embedProviderSelect = document.getElementById("embedProvider");
    const embedModelSelect = document.getElementById("embedModel");
    const customEmbedProviderContainer = document.getElementById("customEmbedProviderContainer");
    const embedHostInput = document.getElementById("embedHost");
    const embedPortInput = document.getElementById("embedPort");
    const embedApiKey = document.getElementById("embedApiKey");
    const pdfTitle = document.getElementById("pdfTitle");
    const zoomInButton = document.getElementById("zoomIn");
    const zoomOutButton = document.getElementById("zoomOut");
    const pageSelector = document.getElementById("pageSelector");
    const pageTotalNumber = document.getElementById("pageNumber");
    const scaleSelector = document.getElementById("scaleSelector");
    const openPdfInput = document.getElementById("openPdfInput");
    //const newPdfInput = document.getElementById("newPdfInput");
    const promptTextArea = document.getElementById("prompt-textarea");
    const sendButton = document.getElementById("sendButton");
    const deleteConversationButton = document.getElementById("deleteButton");
    const pdfUrlForm = document.getElementById("urlForm");
    const pdfUrlInput = document.getElementById("pdfUrl");
    const pdfUrlButton = document.getElementById("pdfUrlButton");
    const pdfCloseButton = document.getElementById("pdfCloseButton");
    const pdfLoadingBar = document.getElementById("loadingBar");
    const pdfDownloadButton = document.getElementById("pdfDownloadButton");
    let loadingTask = null;
    let pdfDocument = null;
    let isCtrlDown = false;
    let openedLocally = false;
    let openedFromUrl = false;
    let openedUrlLink = "";
    let scrollPage = false;
    let currentConversation = [];
    let app = {};
    let fileName = "";
    let currentEmbeddings = [];
    let currentEmbeddingModel = "";
    const models = [
        {
            "provider": "groq",
            "models": [
                "llama-3.1-405b-reasoning",
                "llama-3.1-70b-versatile",
                "llama-3.1-8b-instant",
                "llama3-70b-8192",
                "llama3-8b-8192",
                "mixtral-8x7b-32768",
                "gemma-7b-it",
                "gemma2-9b-it"
            ]
        },
        {
            "provider": "openai",
            "models": [
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4-turbo",
                "gpt-4",
                "gpt-3.5-turbo-0125"
            ]
        },
        {
            "provider": "google",
            "models": [
                "gemini-1.5-pro-exp-0801",
                "gemini-1.5-flash",
                "gemini-1.5-pro",
            ]
        }
    ];
    setStateOnLoad();
    //pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs'
    document.addEventListener("keydown", (e) => {
        if (e.which === 17) {
            container.style.justifyContent = "space-evenly";
            isCtrlDown = true;
        }
    });
    document.addEventListener("keyup", (e) => {
        if (e.which === 17)
            isCtrlDown = false;
    });
    document.addEventListener("mousewheel", (e) => {
        if (isCtrlDown && pdfDocument) {
            handleMouseWheel(e);
        }
    }, { passive: false });
    function saveStateApp() {
        if (localStorage.getItem("app")) {
            localStorage.setItem("app", JSON.stringify(app));
            return true;
        }
        return false;
    }
    function setStateApp(chatOrEmbed, key, value) {
        const data = app[chatOrEmbed];
        const temp = key.split(".");
        let pr = "";
        let secondPr = "";
        if (temp.length > 1) {
            pr = temp[0];
            secondPr = temp[1];
        }
        else {
            pr = key;
        }
        Object.keys(data).forEach(function (prop) {
            if (prop === pr) {
                if (secondPr !== "") {
                    data[prop][secondPr] = value;
                }
                else {
                    data[prop] = value;
                }
            }
        });
        if (saveStateApp()) {
            return true;
        }
        return false;
    }
    async function setStateOnLoad() {
        if (!localStorage.getItem("app")) {
            const t = {
                "chat": {
                    "provider": "OpenAI",
                    "model": "gpt-4o-mini",
                    "apiKey": {
                        "google": "",
                        "openai": "",
                        "groq": ""
                    },
                    "host": "localhost",
                    "port": "11434"
                },
                "embeddings": {
                    "provider": "OpenAI",
                    "model": "text-embedding-3-small",
                    "apiKey": {
                        "openai": ""
                    },
                    "host": "localhost",
                    "port": "11434"
                }
            };
            localStorage.setItem("app", JSON.stringify(t));
            app = t;
            console.log("app set");
        }
        else {
            app = JSON.parse(localStorage.getItem("app"));
        }
        chatProviderSelect.value = app["chat"]["provider"];
        chatModelSelect.innerHTML = "";
        let modelName = "";
        if (chatProviderSelect.value === "Ollama") {
            customChatProviderContainer.style.display = "flex";
        }
        else {
            customChatProviderContainer.hide();
            models.forEach((m) => {
                if (m.provider === chatProviderSelect.value.toLowerCase()) {
                    modelName = m.models[0];
                    m.models.forEach((mn) => {
                        const opt = document.createElement("option");
                        opt.innerText = mn;
                        chatModelSelect.appendChild(opt);
                        if (app["chat"]["model"] === mn) {
                            modelName = mn;
                        }
                    });
                }
            });
            chatModelSelect.value = modelName;
        }
        chatHostInput.value = app["chat"]["host"];
        chatPortInput.value = app["chat"]["port"];
        chatApiKey.value = app["chat"]["apiKey"][app["chat"]["provider"].toLowerCase()];
        embedProviderSelect.value = app["embeddings"]["provider"];
        if (embedProviderSelect.value === "Ollama") {
            customEmbedProviderContainer.style.display = "flex";
        }
        else {
            customEmbedProviderContainer.hide();
        }
        console.log(app["embeddings"]["model"]);
        embedModelSelect.value = app["embeddings"]["model"];
        embedHostInput.value = app["embeddings"]["host"];
        embedPortInput.value = app["embeddings"]["port"];
        embedApiKey.value = app["embeddings"]["apiKey"][app["embeddings"]["provider"].toLowerCase()];
    }
    function getTextWidth(text, textarea) {
        const span = document.createElement('span');
        span.style.visibility = 'hidden';
        span.style.position = 'absolute';
        span.style.whiteSpace = 'pre';
        span.style.fontFamily = window.getComputedStyle(textarea).fontFamily;
        span.style.fontSize = window.getComputedStyle(textarea).fontSize;
        span.style.fontWeight = window.getComputedStyle(textarea).fontWeight;
        span.style.letterSpacing = window.getComputedStyle(textarea).letterSpacing;
        span.textContent = text;
        document.body.appendChild(span);
        const textWidth = span.getBoundingClientRect().width;
        document.body.removeChild(span);
        return textWidth;
    }
    function test(link) {
    }
    async function openPDF(data, viewer, linkService) {
        let dataBuffer = data;
        landingPage.hide();
        loadingPage.show();
        // if(openedFromUrl && openedUrlLink !== "") {
        // //    console.log("yo")
        // //    const resp = await test(openedUrlLink);
        // //    dataBuffer = resp.currentTarget.response;
        //     try{
        //         let headers = {
        //             "Access-Control-Allow-Origin": "*"
        //         }
        //         const t = await fetch(openedUrlLink, {
        //             method:"GET",
        //             headers: headers,
        //             mode:"no-cors"
        //         })
        //         console.log(t);
        //         console.log(t.arrayBuffer());
        //     }catch(e) {
        //         console.log(e)
        //     }
        // }   
        loadingTask = pdfjsLib.getDocument(dataBuffer);
        loadingTask.onPassword = (e) => {
            console.log(e);
        };
        loadingTask.onProgress = (e) => {
            pdfLoadingBar.style.width = `${(e.loaded / e.total) * 100.0}%`;
        };
        pdfDocument = await loadingTask.promise;
        currentPageNumber = 1;
        totalPageNumber = pdfDocument.numPages;
        pageTotalNumber.innerHTML = totalPageNumber;
        const metadata = await pdfDocument.getMetadata();
        pdfTitle.innerHTML = metadata.info.Title ? metadata.info.Title : fileName !== "" ? fileName : "Untitled";
        if (metadata.info.Title) {
            pdfTitle.innerHTML = metadata.info.Title;
        }
        else {
        }
        // Document loaded, specifying document for the viewer and
        // the (optional) linkService.
        viewer.setDocument(pdfDocument);
        linkService.setDocument(pdfDocument, null);
    }
    function findWrapPosition(text, maxWidth, textarea) {
        let start = 0;
        let end = text.length;
        let wrapPosition = -1;
        while (start < end) {
            const mid = Math.floor((start + end) / 2);
            const currentText = text.substr(0, mid);
            if (getTextWidth(currentText, textarea) <= maxWidth) {
                wrapPosition = mid;
                start = mid + 1;
            }
            else {
                end = mid;
            }
        }
        return wrapPosition;
    }
    async function closePDF(viewer, linkService) {
        if (!loadingTask) {
            return Promise.resolve();
        }
        const promise = await loadingTask.destroy();
        loadingTask = null;
        if (pdfDocument) {
            pdfDocument = null;
            viewer.setDocument(null);
            linkService.setDocument(null, null);
        }
        landingPage.show();
        pdfControls.hide();
        pdfInputs.hide();
        pdfLoadingBar.style.width = "0%";
        pdfTitle.innerText = "ChatPDF";
        openedLocally = false;
        openedFromUrl = false;
        openedUrlLink = "";
        fileName = "";
        promptBarContainer.hide();
        conversationListContainer.innerHTML = "";
        conversationEmpty.style.display = "flex";
        openPdfInput.value = null;
        currentConversation = [];
        return promise;
    }
    function pdfViewZoomOut(pdfViewer) {
        if (!pdfDocument)
            return;
        let newScale = pdfViewer.currentScale;
        newScale = (newScale / DEFAULT_SCALE_DELTA).toFixed(2);
        newScale = Math.floor(newScale * 10) / 10;
        newScale = Math.max(MIN_SCALE, newScale);
        container.style.justifyContent = "center";
        pdfViewer.currentScaleValue = newScale;
        const scaleToView = (pdfViewer.currentScaleValue * 100.0).toFixed(0);
        scaleSelector.value = `${scaleToView}%`;
    }
    function pdfViewZoomIn(pdfViewer) {
        if (!pdfDocument)
            return;
        let newScale = pdfViewer.currentScale;
        newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
        newScale = Math.ceil(newScale * 10) / 10;
        newScale = Math.min(MAX_SCALE, newScale);
        container.style.justifyContent = "center";
        pdfViewer.currentScaleValue = newScale;
        const scaleToView = (pdfViewer.currentScaleValue * 100.0).toFixed(0);
        scaleSelector.value = `${scaleToView}%`;
    }
    function adjustScrollPosition(pdfViewer, event, prevScale, newScale) {
        const viewerContainer = pdfViewer.container;
        const rect = viewerContainer.getBoundingClientRect();
        const mouseX = (event.clientX - rect.left) / newScale;
        const mouseY = (event.clientY - rect.top) / newScale;
        const scrollLeft = (pdfViewer._location.left) + mouseX * (newScale - prevScale);
        const scrollTop = (pdfViewer._location.top) - mouseY * (newScale - prevScale);
        pdfViewer._location.left = scrollLeft;
        pdfViewer._location.top = scrollTop;
    }
    function handleMouseWheel(event) {
        event.preventDefault();
        const pdfViewer = pdfSinglePageViewer;
        if (!pdfViewer)
            return;
        if (!pdfDocument)
            return;
        const delta = -event.deltaY;
        const zoomIn = delta > 0;
        const prevScale = pdfViewer.currentScaleValue || 1;
        let newScale = zoomIn ? prevScale * 1.25 : prevScale / 1.25;
        newScale = Math.max(MIN_SCALE, Math.min(newScale, MAX_SCALE));
        adjustScrollPosition(pdfViewer, event, prevScale, newScale);
        pdfViewer.currentScaleValue = newScale;
        const scaleToView = (pdfViewer.currentScaleValue * 100.0).toFixed(0);
        document.getElementById('scaleSelector').value = `${scaleToView}%`;
        pdfViewer.currentScale = newScale;
    }
    function wrap(textarea) {
        // const cols = Math.ceil(textarea.clientWidth / charWidth);
        // console.log(cols);
        // const textLines = textarea.value.split("\n").map((line) => {
        //     let wrapped = "";
        //     while(line.length > cols) {
        //         let wrapPosition = line.lastIndexOf(" ", cols);
        //         console.log(wrapPosition);
        //         if(wrapPosition === -1) {
        //             wrapPosition = cols;
        //         }
        //         let wrap = line.substr(0, wrapPosition);
        //         wrapped += wrap + (wrap.length > 0 ? "\n" : "");
        //         line = line.substr(wrapPosition).trim();
        //         if (line[0] === " ") {
        //             line = line.substr(1);
        //         }
        //         if (line === "\n") {
        //             line = "";
        //         }
        //     }
        //     return wrapped + line;
        // }).join("\n");
        const textLines = textarea.value.split("\n").map((line) => {
            let wrapped = "";
            while (getTextWidth(line, textarea) > textarea.offsetWidth - 30) {
                let wrapPosition = findWrapPosition(line, textarea.offsetWidth - 30, textarea);
                if (wrapPosition === -1) {
                    wrapPosition = line.length;
                }
                let wrap = line.substr(0, wrapPosition);
                wrapped += wrap + "\n";
                //console.log(wrapped)
                line = line.substr(wrapPosition);
                if (line[0] === " ") {
                    line = line.substr(1);
                }
                if (line === "\n") {
                    line = "";
                }
            }
            return wrapped + line;
        }).join("\n");
        textarea.value = textLines;
        textarea.scrollTop = textarea.scrollHeight;
        if (textarea.scrollHeight > textarea.clientHeight) {
            textarea.style.height = `${textarea.scrollHeight - 16}px`;
        }
        if (textarea.scrollTop > 0) {
            textarea.style.overflowY = "auto";
        }
    }
    let totalPageNumber = 0;
    let currentPageNumber = 0;
    const downloadFile = (url, filename = '') => {
        if (filename.length === 0)
            filename = url.split('/').pop();
        const req = new XMLHttpRequest();
        req.open('GET', url, true);
        req.responseType = 'blob';
        req.onload = function () {
            const blob = new Blob([req.response], {
                type: 'application/pdf',
            });
            const isIE = false || !!document.documentMode;
            if (isIE) {
                window.navigator.msSaveBlob(blob, filename);
            }
            else {
                const windowUrl = window.URL || window.webkitURL;
                const href = windowUrl.createObjectURL(blob);
                const a = document.createElement('a');
                a.setAttribute('download', filename);
                a.setAttribute('href', href);
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        };
        req.send();
    };
    function getModels(provider) {
        models.forEach((m) => {
            if (m.provider === provider) {
                return m.models;
            }
        });
    }
    function getConversation(path) {
        if (!db)
            return;
        let tx = db.transaction('conversations', 'readwrite');
        const convos = tx.objectStore("conversations");
        let result = null;
        convos.get(path).onsuccess = (e) => {
            if (e.target.result !== undefined) {
                result = e.target.result;
            }
            else {
                result = {
                    "id": path,
                    "name": fileName,
                    "url": openedUrlLink,
                    "messages": [],
                    "embeddings": [],
                    "embeddingModel": app["embeddings"]["model"]
                };
                convos.add(result);
            }
            currentEmbeddingModel = result.embeddingModel;
        };
        // const conversations = app["conversations"];
        // let result = null;
        // conversations.forEach((v) => {
        //     if(v.name === path || v.url === path) {
        //         result = v;
        //     }
        // });
        // if(!result) {
        //     result = {
        //         "name": fileName,
        //         "url": openedUrlLink,
        //         "messages": [],
        //         "embeddings": []
        //     }
        //     app["conversations"].push(result);
        //     saveStateApp();
        // }
        // return result;
    }
    function saveConversation(path) {
        if (!db)
            return;
        let tx = db.transaction('conversations', 'readwrite');
        const convos = tx.objectStore("conversations");
        convos.get(path).onsuccess = (e) => {
            if (e.target.result !== undefined) {
                const test = e.target.result;
                test.messages = currentConversation;
                convos.put(test);
            }
        };
        // const conversation = getConversation(path);
        // if(!conversation) return;
        // conversation.messages = currentConversation;
        // saveStateApp();
    }
    function clearCurrentMessages(path) {
        if (!db)
            return;
        let tx = db.transaction('conversations', 'readwrite');
        const convos = tx.objectStore("conversations");
        convos.get(path).onsuccess = (e) => {
            if (e.target.result !== undefined) {
                const test = e.target.result;
                test.messages = [];
                convos.put(test);
                currentConversation = [];
                conversationListContainer.innerHTML = "";
                deleteConversationButton.disable();
            }
            else {
                console.log("clearCurrentMessages: failed to fetch conversation with id", path);
            }
        };
        // const conversation = getConversation(path);
        // if(!conversation) return;
        // conversation.messages = [];
        // currentConversation = [];
        // conversationListContainer.innerHTML = "";
        // deleteConversationButton.disable();
        // saveStateApp();
    }
    function appendConversations2(messages) {
        if (messages.length === 0)
            return;
        messages.forEach((v) => {
            const container = appendMessage(v.role, v.content);
            if (v.role === "assistant") {
                const codeContainer = container.querySelectorAll("pre code");
                if (codeContainer.length > 0) {
                    for (let i = 0; i < codeContainer.length; i++) {
                        hljs.highlightElement(codeContainer[i]);
                    }
                }
            }
        });
        currentConversation = messages;
    }
    function appendConversations(path) {
        if (!db)
            return;
        let tx = db.transaction('conversations', 'readwrite');
        const convos = tx.objectStore("conversations");
        convos.get(path).onsuccess = (e) => {
            if (e.target.result !== undefined) {
                const test = e.target.result;
                if (test.messages.length === 0)
                    return;
                test.messages.forEach((v) => {
                    const container = appendMessage(v.role, v.content);
                    if (v.role === "assistant") {
                        const codeContainer = container.querySelectorAll("pre code");
                        if (codeContainer.length > 0) {
                            for (let i = 0; i < codeContainer.length; i++) {
                                hljs.highlightElement(codeContainer[i]);
                            }
                        }
                    }
                });
                currentConversation = test.messages;
                conversationContainer.scrollTop = conversationContainer.scrollHeight;
            }
            else {
                console.log("appendConversations: failed to fetch conversation with id", path);
            }
        };
        // const conversation = getConversation(path);
        // if(conversation.messages.length === 0) return;
        // conversation.messages.forEach((v) => {
        //     const container = appendMessage(v.role, v.content);
        //     if (v.role === "assistant"){
        //         const codeContainer = container.querySelectorAll("pre code");
        //         if(codeContainer.length > 0){
        //             for(let i = 0; i < codeContainer.length; i++){
        //                 hljs.highlightElement(codeContainer[i]);
        //             }
        //         }
        //     }
        // });
        // currentConversation = conversation.messages;
        // conversationContainer.scrollTop = conversationContainer.scrollHeight;
    }
    chatProviderSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "Ollama") {
            customChatProviderContainer.style.display = "flex";
            chatModelSelect.innerHTML = "";
            chatApiKey.value = "";
        }
        else {
            customChatProviderContainer.hide();
            chatModelSelect.innerHTML = "";
            chatApiKey.value = app["chat"]["apiKey"][val.toLowerCase()];
            let modelName = app["chat"]["model"];
            let defModel = "";
            let modelNameSet = false;
            models.forEach((m) => {
                if (m.provider === val.toLowerCase()) {
                    defModel = m.models[0];
                    m.models.forEach((mn) => {
                        const opt = document.createElement("option");
                        opt.innerText = mn;
                        chatModelSelect.appendChild(opt);
                        if (modelName === mn) {
                            setStateApp("chat", "model", modelName);
                            modelNameSet = true;
                        }
                    });
                }
            });
            if (!modelNameSet) {
                setStateApp("chat", "model", defModel);
                modelName = defModel;
            }
            chatModelSelect.value = modelName;
        }
        setStateApp("chat", "provider", val);
    });
    chatModelSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        setStateApp("chat", "model", val);
    });
    chatApiKey.addEventListener("input", (e) => {
        const val = e.target.value;
        setStateApp("chat", `apiKey.${app["chat"]["provider"].toLowerCase()}`, val);
    });
    chatHostInput.addEventListener("input", (e) => {
        const val = e.target.value;
        setStateApp("chat", "host", val);
    });
    chatPortInput.addEventListener("input", (e) => {
        const val = e.target.value;
        setStateApp("chat", "port", val);
    });
    embedProviderSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (val === "Ollama") {
            customEmbedProviderContainer.style.display = "flex";
        }
        else {
            customEmbedProviderContainer.hide();
        }
        setStateApp("embeddings", "provider", val);
    });
    embedModelSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        setStateApp("embeddings", "model", val);
    });
    embedApiKey.addEventListener("input", (e) => {
        const val = e.target.value;
        setStateApp("embeddings", `apiKey.${app["embeddings"]["provider"].toLowerCase()}`, val);
    });
    embedHostInput.addEventListener("input", (e) => {
        const val = e.target.value;
        setStateApp("embeddings", "host", val);
    });
    embedPortInput.addEventListener("input", (e) => {
        const val = e.target.value;
        setStateApp("embeddings", "port", val);
    });
    pdfDownloadButton.addEventListener("click", (e) => {
        if (!pdfDocument)
            return;
        if (!openedFromUrl && openedUrlLink === "")
            return;
        const filename = openedUrlLink.split('/').pop();
        let ext = filename.split('.').pop();
        if (ext !== "pdf")
            ext = ".pdf";
        downloadFile(openedUrlLink, filename + ext);
    });
    pdfUrlButton.addEventListener("click", async (e) => {
        if (pdfUrlInput.value === "")
            return;
        try {
            openedFromUrl = true;
            openedUrlLink = pdfUrlInput.value;
            await openPDF(pdfUrlInput.value, pdfSinglePageViewer, pdfLinkService);
        }
        catch (e) {
            loadingPage.hide();
            landingPage.show();
        }
        pdfUrlInput.value = "";
        pdfUrlButton.disable();
    });
    pdfUrlInput.addEventListener("input", (e) => {
        console.log(e.target.value);
        if (e.target.value === "") {
            pdfUrlButton.disable();
        }
        else {
            pdfUrlButton.enable();
        }
    });
    pdfUrlForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (pdfUrlInput.value === "")
            return;
        try {
            openedFromUrl = true;
            openedUrlLink = pdfUrlInput.value;
            await openPDF(pdfUrlInput.value, pdfSinglePageViewer, pdfLinkService);
        }
        catch (e) {
            loadingPage.hide();
            landingPage.show();
        }
        pdfUrlInput.value = "";
    });
    openPdfInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file)
            return;
        if (file.type !== "application/pdf")
            return;
        const reader = new FileReader();
        reader.addEventListener("loadstart", () => {
            loadingPage.show();
            landingPage.hide();
        });
        reader.addEventListener("progress", (e) => {
            pdfLoadingBar.style.width = `${(e.loaded / e.total) * 100.0}%`;
            console.log("????");
        });
        reader.addEventListener("load", async (f) => {
            const typedarray = new Uint8Array(f.target.result);
            //await closePDF(pdfSinglePageViewer, pdfLinkService);
            fileName = file.name;
            await openPDF(typedarray, pdfSinglePageViewer, pdfLinkService);
        });
        reader.readAsArrayBuffer(file);
    });
    pdfCloseButton.addEventListener("click", async (e) => {
        await closePDF(pdfSinglePageViewer, pdfLinkService);
    });
    promptTextArea.addEventListener("paste", (e) => {
        //document.execCommand("insertText", false, e.clipboardData.getData("text"));
        //e.target.value += e.clipboardData.getData('text');
        sendButton.disabled = false;
        //wrap(promptTextArea);
    });
    promptTextArea.addEventListener("input", (e) => {
        wrap(promptTextArea);
        if (e.currentTarget.value === "") {
            e.target.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
            sendButton.disabled = true;
        }
        else {
            sendButton.disabled = false;
        }
    });
    promptTextArea.addEventListener("keydown", (e) => {
        const k = e.which;
        if (k == 20 /* Caps lock */
            || k == 16 /* Shift */
            || k == 9 /* Tab */
            || k == 27 /* Escape Key */
            || k == 17 /* Control Key */
            || k == 91 /* Windows Command Key */
            || k == 19 /* Pause Break */
            || k == 18 /* Alt Key */
            || k == 93 /* Right Click Point Key */
            || (k >= 35 && k <= 40) /* Home, End, Arrow Keys */
            || k == 45 /* Insert Key */
            || (k >= 33 && k <= 34) /*Page Down, Page Up */
            || (k >= 112 && k <= 123) /* F1 - F12 */
            || (k >= 144 && k <= 145)) { /* Num Lock, Scroll Lock */
            return;
        }
        else {
            if (e.target.selectionEnd - e.target.selectionStart > 1) {
                if (e.ctrlKey && (e.which === 67 || e.which === 13))
                    return;
                const heightInPx = parseInt(e.target.style.height.split("px")[0]);
                if (heightInPx > MIN_TEXTAREA_HEIGHT) {
                    const lineLength = e.target.value.substr(e.target.selectionStart, e.target.selectionEnd).split("\n").length;
                    const lineToRemove = heightInPx - (24 * (lineLength));
                    e.target.style.height = `${lineToRemove}px`;
                }
            }
        }
        if (e.which === 8) {
            var textLines = e.target.value.substr(0, e.target.selectionStart).split("\n");
            var currentLineNumber = textLines.length;
            var currentColumnIndex = textLines[textLines.length - 1].length;
            const heightInPx = parseInt(e.target.style.height.split("px")[0]);
            if (e.target.scrollTop == 0) {
                e.target.style.overflowY = "hidden";
            }
            if (e.target.selectionEnd - e.target.selectionStart > 1) {
                if (heightInPx > MIN_TEXTAREA_HEIGHT) {
                    const lineLength = e.target.value.substr(e.target.selectionStart, e.target.selectionEnd).split("\n").length;
                    const lineToRemove = heightInPx - (24 * (lineLength));
                    e.target.style.height = `${lineToRemove}px`;
                }
                //wrap(promptTextArea);
            }
            else {
                console.log(currentLineNumber);
                if (currentColumnIndex === 0 && currentLineNumber > 1) {
                    if (heightInPx > MIN_TEXTAREA_HEIGHT) {
                        e.target.style.height = `${heightInPx - 24}px`;
                    }
                }
                //wrap(promptTextArea);
            }
            if (promptTextArea.selectionStart === 0 && promptTextArea.selectionEnd === promptTextArea.value.length) {
                e.target.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
            }
        }
    });
    promptTextArea.addEventListener("keypress", (e) => {
        if (e.which === 13 && !e.shiftKey) {
            if (promptTextArea.value === "")
                return;
            e.preventDefault();
            //not supported because of CORS https://github.com/anthropics/anthropic-sdk-typescript/issues/410
            //makeClaudeAiRequest("", promptTextArea.value);
            if (app["chat"]["provider"] === "Google") {
                makeGoogleAiRequest(app["chat"]["apiKey"]["google"], promptTextArea.value);
            }
            else {
                const provider = app["chat"]["provider"];
                const apiKey = app["chat"]["apiKey"][provider.toLowerCase()];
                const modelName = app["chat"]["model"];
                makeOpenAiRequest(apiKey, promptTextArea.value, provider, modelName);
            }
            //document.execCommand("insertText", false, e.clipboardData.getData("text"));
            promptTextArea.value = "";
            promptTextArea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
            sendButton.disabled = true;
        }
        if (e.shiftKey && e.which === 13) {
            e.preventDefault();
            document.execCommand("insertText", false, '\n');
            e.target.style.height = `${e.target.scrollHeight - 16}px`;
            //promptTextArea.value += '\n';
            promptTextArea.scrollTop = promptTextArea.scrollHeight;
            if (promptTextArea.scrollTop > 0) {
                promptTextArea.style.overflowY = "auto";
            }
        }
    });
    // newPdfInput.addEventListener("change", async (e) => {
    //     const file = e.target.files[0];
    //     if(!file) return;
    //     if(file.type !== "application/pdf") return;
    //     const reader = new FileReader();
    //     reader.addEventListener("load", async (file) => {
    //         const typedarray = new Uint8Array(file.target.result);
    //         await closePDF(pdfSinglePageViewer, pdfLinkService);
    //         await openPDF(typedarray, pdfSinglePageViewer, pdfLinkService);
    //     })
    //     reader.readAsArrayBuffer(file);
    // });
    sendButton.addEventListener("click", (e) => {
        console.log(e);
        if (promptTextArea.value === "")
            return;
        e.preventDefault();
        //not supported because of CORS https://github.com/anthropics/anthropic-sdk-typescript/issues/410
        //makeClaudeAiRequest("", promptTextArea.value);
        if (app["chat"]["provider"] === "Google") {
            makeGoogleAiRequest(app["chat"]["apiKey"]["google"], promptTextArea.value);
        }
        else {
            const provider = app["chat"]["provider"];
            const apiKey = app["chat"]["apiKey"][provider.toLowerCase()];
            const modelName = app["chat"]["model"];
            makeOpenAiRequest(apiKey, promptTextArea.value, provider, modelName);
        }
        //document.execCommand("insertText", false, e.clipboardData.getData("text"));
        promptTextArea.value = "";
        promptTextArea.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
        sendButton.disabled = true;
    });
    deleteConversationButton.addEventListener("click", (e) => {
        e.preventDefault();
        const path = openedFromUrl ? openedUrlLink : fileName;
        clearCurrentMessages(path);
    });
    scaleSelector.addEventListener("keyup", (e) => {
        if (!pdfDocument)
            return;
        if (e.which === 13) {
            if (!parseInt(scaleSelector.value)) {
                scaleSelector.value = `${pdfSinglePageViewer.currentScaleValue * 100.0}%`;
                return scaleSelector.blur();
            }
            if (scaleSelector.value / 100.0 >= MIN_SCALE && scaleSelector.value / 100.0 <= MAX_SCALE) {
                pdfSinglePageViewer.currentScaleValue = scaleSelector.value / 100.0;
                scaleSelector.value = `${pdfSinglePageViewer.currentScaleValue * 100.0}%`;
            }
            else {
                scaleSelector.value = `${pdfSinglePageViewer.currentScaleValue * 100.0}%`;
            }
            return scaleSelector.blur();
        }
    });
    scaleSelector.addEventListener("blur", (e) => {
        if (!pdfDocument)
            return;
        if (!parseInt(scaleSelector.value)) {
            scaleSelector.value = `${pdfSinglePageViewer.currentScaleValue * 100.0}%`;
            return;
        }
        if (scaleSelector.value / 100.0 >= MIN_SCALE && scaleSelector.value / 100.0 <= MAX_SCALE) {
            pdfSinglePageViewer.currentScaleValue = scaleSelector.value / 100.0;
            scaleSelector.value = `${pdfSinglePageViewer.currentScaleValue * 100.0}%`;
        }
        else {
            scaleSelector.value = `${pdfSinglePageViewer.currentScaleValue * 100.0}%`;
        }
    });
    pageSelector.addEventListener("keyup", (e) => {
        if (!pdfDocument)
            return;
        if (e.which === 13) {
            if (!parseInt(pageSelector.value)) {
                pageSelector.value = currentPageNumber;
                return pageSelector.blur();
            }
            if (totalPageNumber === 0)
                return;
            if (pageSelector.value < 1 || pageSelector.value > totalPageNumber) {
                pageSelector.value = currentPageNumber;
            }
            else {
                if (currentPageNumber !== parseInt(pageSelector.value)) {
                    currentPageNumber = parseInt(pageSelector.value);
                    pdfSinglePageViewer.currentPageNumber = currentPageNumber;
                }
                else {
                    pageSelector.value = currentPageNumber;
                }
            }
            return pageSelector.blur();
        }
    });
    pageSelector.addEventListener("blur", (e) => {
        if (!pdfDocument)
            return;
        if (!parseInt(pageSelector.value)) {
            pageSelector.value = currentPageNumber;
            return;
        }
        if (parseInt(pageSelector.value) < 1 || parseInt(pageSelector.value) > totalPageNumber) {
            pageSelector.value = currentPageNumber;
        }
        else {
            if (currentPageNumber !== parseInt(pageSelector.value)) {
                currentPageNumber = parseInt(pageSelector.value);
                pdfSinglePageViewer.currentPageNumber = currentPageNumber;
            }
            else {
                pageSelector.value = currentPageNumber;
            }
        }
    });
    zoomInButton.addEventListener("click", (event) => {
        event.preventDefault();
        pdfViewZoomIn(pdfSinglePageViewer);
    });
    zoomOutButton.addEventListener("click", (event) => {
        event.preventDefault();
        pdfViewZoomOut(pdfSinglePageViewer);
    });
    pageSelector.addEventListener("focus", (event) => {
        return event.target.select();
    });
    scaleSelector.addEventListener("focus", (event) => {
        return event.target.select();
    });
    const eventBus = new pdfjsViewer.EventBus();
    // (Optionally) enable hyperlinks within PDF files.
    const pdfLinkService = new pdfjsViewer.PDFLinkService({
        eventBus,
    });
    // (Optionally) enable find controller.
    const pdfFindController = new pdfjsViewer.PDFFindController({
        eventBus,
        linkService: pdfLinkService,
    });
    const pdfSinglePageViewer = new pdfjsViewer.PDFViewer({
        container,
        eventBus,
        linkService: pdfLinkService,
        findController: pdfFindController,
    });
    pdfLinkService.setViewer(pdfSinglePageViewer);
    eventBus.on("pagesinit", async function () {
        if (conversationEmpty.style.display !== "none") {
            conversationEmpty.hide();
        }
        let path = "";
        if (openedFromUrl) {
            path = openedUrlLink;
            pdfDownloadButton.show();
        }
        else {
            path = fileName;
            pdfDownloadButton.hide();
        }
        getConversation(path);
        //appendConversations(path);
        deleteConversationButton.disable();
        let tx = db.transaction('conversations', 'readwrite');
        const convos = tx.objectStore("conversations");
        convos.get(path).onsuccess = async (e) => {
            if (e.target.result !== undefined) {
                const test = e.target.result;
                let embeddingsExists = test.embeddings.length > 0;
                if (!embeddingsExists) {
                    await getEmbeddings();
                    if (currentEmbeddings.length > 0) {
                        console.log("embbeddings set");
                    }
                    else {
                        console.log("failed to fetch embeddings");
                    }
                }
                else {
                    console.log("embeddings already exists");
                    currentEmbeddings = test.embeddings;
                }
                appendConversations2(test.messages);
                // We can use pdfViewer now, e.g. let's change default scale.
                promptBarContainer.show();
                pdfLoadingBar.style.width = "0%";
                pdfjsViewer.currentScaleValue = "auto";
                pdfSinglePageViewer.currentScaleValue = 1.0;
                scaleSelector.value = `100%`;
                document.getElementById("modelName").innerText = app["chat"]["model"];
                pageSelector.value = currentPageNumber;
                loadingPage.hide();
                pdfControls.show();
                pdfInputs.show();
                promptTextArea.focus();
                conversationContainer.scrollTop = conversationContainer.scrollHeight;
            }
        };
    });
    eventBus.on("pagerendered", function () {
        //statusBar.show()
    });
    eventBus.on("pagechanging", function (event) {
        currentPageNumber = event.pageNumber;
        pageSelector.value = currentPageNumber;
    });
    async function makeOpenAiRequest(apiKey, message, provider, model, ce) {
        let endPoint = "https://api.openai.com/v1/chat/completions";
        if (provider === "Groq") {
            endPoint = "https://api.groq.com/openai/v1/chat/completions";
        }
        else if (provider === "Ollama") {
            endPoint = `http://${app["chat"]["host"]}:${app["chat"]["port"]}/v1/chat/completions`;
            apiKey = "ollama";
        }
        const xhr = new XMLHttpRequest();
        xhr.open("POST", endPoint, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);
        let last_response_len = 0;
        const errorTemplate = (error) => {
            return `<div class="error"><div class="error-title">Error</div><div class="error-content">${error}</div></div>`;
        };
        appendMessage("user", message);
        scrollPage = true;
        currentConversation.push({
            "role": "user",
            "content": message
        });
        let path = openedFromUrl ? openedUrlLink : fileName;
        //saveConversation(path);
        const assistantContainer = appendMessage("assistant", "");
        promptTextArea.disable();
        conversationContainer.scrollTop = conversationContainer.scrollHeight;
        let topK = [];
        try {
            const emb = await getEmbedding(message);
            if (currentEmbeddings.length > 0) {
                if (currentEmbeddings[0].embedding.length === emb.length) {
                    topK = sortBySimilarity(emb, currentEmbeddings, 3);
                }
                else {
                    console.log("dimensions do not match, ", currentEmbeddings[0].embedding.length, emb.length);
                }
            }
        }
        catch (e) {
            console.log(e);
        }
        let eventString = "";
        xhr.onprogress = (e) => {
            let test = xhr.response.substr(last_response_len).split("data: [DONE]").join("").trim().split("data: ").filter((v) => !!v);
            test.forEach((data) => {
                try {
                    const parsedData = JSON.parse(data);
                    if (parsedData.choices[0].finish_reason === null) {
                        eventString += parsedData.choices[0].delta.content;
                    }
                    else {
                        console.log("FINISH REASON:", parsedData.choices[0].finish_reason);
                    }
                    last_response_len = xhr.responseText.length;
                }
                catch (e) {
                    last_response_len -= data.length;
                    console.error(e, data, test);
                }
            });
            assistantContainer.innerHTML = marked.parse(eventString);
            const codeContainer = assistantContainer.querySelectorAll("pre code");
            if (codeContainer.length > 0) {
                for (let i = 0; i < codeContainer.length; i++) {
                    hljs.highlightElement(codeContainer[i]);
                }
            }
            preTagStyling(assistantContainer);
            if ((conversationContainer.scrollTop + window.innerHeight + 250) < conversationContainer.scrollHeight) {
                scrollPage = false;
            }
            else {
                scrollPage = true;
            }
            if (scrollPage)
                conversationContainer.scrollTop = conversationContainer.scrollHeight;
        };
        xhr.onreadystatechange = () => {
            if (xhr.readyState === XMLHttpRequest.DONE) {
                const status = xhr.status;
                if (status === 0 || (status >= 200 && status < 400)) {
                    console.log("DONE XHR");
                    currentConversation.push({
                        "role": "assistant",
                        "content": eventString
                    });
                    saveConversation(path);
                    promptTextArea.enable();
                    promptTextArea.focus();
                }
                else {
                    try {
                        const data = JSON.parse(xhr.response);
                        console.log(data.error.message);
                        assistantContainer.innerHTML = errorTemplate(data.error.message);
                    }
                    catch (e) {
                        console.error(e);
                        assistantContainer.innerHTML = errorTemplate(e);
                    }
                    promptTextArea.enable();
                    promptTextArea.focus();
                    currentConversation.pop();
                    throw new Error(`Error processing stream completion (XHR readyState ${xhr.readyState}, status ${xhr.status}).`);
                }
            }
        };
        xhr.onerror = (event) => {
            promptTextArea.enable();
            assistantContainer.innerHTML = errorTemplate("xhr error");
            currentConversation.pop();
            throw new Error(`Error processing stream completion (XHR readyState ${xhr.readyState}, status ${xhr.status}).`);
        };
        let parts = "";
        topK.forEach((v) => {
            parts += v.text + "\n";
        });
        const systemContent = `You are a Chat with PDF application. Your task is to answer the questions based on the given query and retrieved most relevant document parts. Use journalistic tone and mindset when answering questions.
        Here is the QUERY:
        ${message}

        Here is the retrieved most relevant parts of the document:
        ${parts}`;
        const systemMessage = [{
                "role": "system",
                "content": systemContent
            }];
        xhr.send(JSON.stringify({
            "model": model,
            "stream": true,
            "messages": systemMessage.concat(currentConversation)
        }));
    }
    async function makeGoogleAiRequest(apiKey, message) {
        const modelName = app["chat"]["model"];
        if (!modelName) {
            modelName = "gemini-1.5-flash";
        }
        console.log("GOOGLE", modelName);
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?key=${apiKey}`, true);
        xhr.setRequestHeader("Content-Type", "application/json");
        let last_response_len = 0;
        const errorTemplate = (error) => {
            return `<div class="error"><div class="error-title">Error</div><div class="error-content">${error}</div></div>`;
        };
        appendMessage("user", message);
        scrollPage = true;
        currentConversation.push({
            "role": "user",
            "content": message
        });
        const assistantContainer = appendMessage("assistant", "");
        promptTextArea.disable();
        conversationContainer.scrollTop = conversationContainer.scrollHeight;
        let topK = [];
        try {
            const emb = await getEmbedding(message);
            if (currentEmbeddings.length > 0) {
                if (currentEmbeddings[0].embedding.length === emb.length) {
                    topK = sortBySimilarity(emb, currentEmbeddings, 3);
                }
                else {
                    console.log("dimensions do not match, ", currentEmbeddings[0].embedding.length, emb.length);
                }
            }
        }
        catch (e) {
            console.log(e);
        }
        let eventString = "";
        xhr.onprogress = (e) => {
            let test = JSON.parse("[" + xhr.response.substr(1, last_response_len - 1) + "]");
            let t = "";
            test.forEach((data) => {
                if (data.candidates[0].finishReason === "STOP") {
                    t += data.candidates[0].content.parts[0].text;
                    eventString = t;
                }
                else {
                    console.log("FINISH REASON:", data.candidates[0].finishReason);
                }
            });
            assistantContainer.innerHTML = marked.parse(t);
            const codeContainer = assistantContainer.querySelectorAll("pre code");
            if (codeContainer.length > 0) {
                for (let i = 0; i < codeContainer.length; i++) {
                    hljs.highlightElement(codeContainer[i]);
                }
            }
            preTagStyling(assistantContainer);
            last_response_len = xhr.response.length;
            //console.log((conversationContainer.scrollTop + window.innerHeight + 100), conversationContainer.scrollHeight)
            //if((conversationContainer.scrollTop + window.innerHeight + 100) > conversationContainer.scrollHeight){
            //    conversationContainer.scrollTop = conversationContainer.scrollHeight;
            //}
            conversationContainer.scrollTop = conversationContainer.scrollHeight;
        };
        xhr.onreadystatechange = () => {
            if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
                console.log("started");
            }
            if (xhr.readyState === XMLHttpRequest.DONE) {
                const status = xhr.status;
                if (status === 0 || (status >= 200 && status < 400)) {
                    console.log("DONE XHR");
                    promptTextArea.enable();
                    promptTextArea.focus();
                    currentConversation.push({
                        "role": "assistant",
                        "content": eventString
                    });
                    let path = openedFromUrl ? openedUrlLink : fileName;
                    saveConversation(path);
                }
                else {
                    try {
                        const data = JSON.parse(xhr.response);
                        console.log(data[0].error.message);
                        assistantContainer.innerHTML = errorTemplate(data[0].error.message);
                    }
                    catch (e) {
                        console.error(e);
                        assistantContainer.innerHTML = errorTemplate(e);
                    }
                    promptTextArea.enable();
                    promptTextArea.focus();
                    currentConversation.pop();
                    throw new Error(`Error processing stream completion (XHR readyState ${xhr.readyState}, status ${xhr.status}).`);
                }
            }
        };
        xhr.onerror = (event) => {
            promptTextArea.enable();
            assistantContainer.innerHTML = errorTemplate("xhr error");
            currentConversation.pop();
            throw new Error(`Error processing stream completion (XHR readyState ${xhr.readyState}, status ${xhr.status}).`);
        };
        let parts = "";
        topK.forEach((v) => {
            parts += v.text + "\n";
        });
        const systemContent = `You are a Chat with PDF application. Your task is to answer the questions based on the given query and retrieved most relevant document parts. Use journalistic tone and mindset when answering questions.
        Here is the QUERY:
        ${message}

        Here is the retrieved most relevant parts of the document:
        ${parts}`;
        const googleConversationMapped = currentConversation.map((v) => {
            return {
                "role": v.role === "user" ? "user" : "model",
                "parts": [{
                        "text": v.content
                    }]
            };
        });
        xhr.send(JSON.stringify({
            "contents": googleConversationMapped,
            "systemInstruction": {
                "role": "user",
                "parts": [
                    {
                        "text": systemContent,
                    }
                ]
            },
            "generationConfig": {
                "temperature": 1,
                "topK": 64,
                "topP": 0.95,
                "maxOutputTokens": 8192,
                "responseMimeType": "text/plain",
            }
        }));
    }
    function appendMessage(role, message) {
        deleteConversationButton.enable();
        const container = document.getElementById("conversation-list");
        const result = document.createElement("div");
        result.className = "conversation";
        let icon = "";
        if (role === "user") {
            icon = `<div class="conversation-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 101 101" style="pointer-events: none; display: block; width: 100%; height: 100%;"><path d="M50.4 54.5c10.1 0 18.2-8.2 18.2-18.2S60.5 18 50.4 18s-18.2 8.2-18.2 18.2 8.1 18.3 18.2 18.3zm0-31.7c7.4 0 13.4 6 13.4 13.4s-6 13.4-13.4 13.4S37 43.7 37 36.3s6-13.5 13.4-13.5zM18.8 83h63.4c1.3 0 2.4-1.1 2.4-2.4 0-12.6-10.3-22.9-22.9-22.9H39.3c-12.6 0-22.9 10.3-22.9 22.9 0 1.3 1.1 2.4 2.4 2.4zm20.5-20.5h22.4c9.2 0 16.7 6.8 17.9 15.7H21.4c1.2-8.9 8.7-15.7 17.9-15.7z"></path></svg>
                    </div>`;
        }
        else if (role === "assistant" || role === "model") {
            icon = `<div class="conversation-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" style="pointer-events: none; display: block; width: 100%; height: 100%;"><g><path d="M57,22V10h0A4.1,4.1,0,0,0,60,6a4,4,0,0,0-8,0,4.1,4.1,0,0,0,3,3.9h0V22H53a7,7,0,0,0-7-7H18a7,7,0,0,0-7,7H9V10H9A4.1,4.1,0,0,0,12,6,4,4,0,0,0,4,6,4.1,4.1,0,0,0,7,9.9H7V22a2.9,2.9,0,0,0-3,3V39a2.9,2.9,0,0,0,3,3h4a7,7,0,0,0,7,7H46a7,7,0,0,0,7-7h2v8c0,3.3-3.2,6-7.1,6h-6A5,5,0,0,0,37,52H33a5,5,0,0,0,0,10h4a5,5,0,0,0,4.9-4h6c5,0,9.1-3.6,9.1-8V42a2.9,2.9,0,0,0,3-3V25A2.9,2.9,0,0,0,57,22ZM7,40a.9.9,0,0,1-1-1V25a.9.9,0,0,1,1-1h4V40Zm40.9-1a4,4,0,0,1-4,4H20.1a4,4,0,0,1-4-4V24a4,4,0,0,1,4-4h5.8a3,3,0,0,1,2.5,1.3l.8,1.3a1.3,1.3,0,0,0,.9.4h3.8a1.3,1.3,0,0,0,.9-.4l.8-1.3A3,3,0,0,1,38.1,20h5.8a4,4,0,0,1,4,4ZM58,39a.9.9,0,0,1-1,1H53V24h4a.9.9,0,0,1,1,1Z"></path><circle cx="39" cy="33" r="5"></circle><circle cx="25" cy="33" r="5"></circle></g></svg>
                    </div>`;
        }
        result.innerHTML += icon;
        const cContent = document.createElement("div");
        cContent.className = "conversation-content";
        if (message === "") {
            const loadingTemplate = `<div class="loadingChat">
                                        <img style="width: 24px; padding: 0; margin:0;" src="./loading2.gif" rel:animated_src="./loading2.gif" rel:auto_play="1" rel:rubbable="1" />
                                    </div>`;
            const messageTemplate = `<div class="conversation-content">
                ${loadingTemplate}
            </div>`;
            cContent.innerHTML += messageTemplate;
        }
        else {
            if (role === "assistant") {
                cContent.innerHTML = marked.parse(message);
                preTagStyling(cContent);
            }
            else {
                cContent.innerText += message;
            }
        }
        result.appendChild(cContent);
        container.appendChild(result);
        return cContent;
    }
    function preTagStyling(container) {
        var snippets = container.querySelectorAll('pre');
        if (snippets.length === 0)
            return;
        let nonDirtySnippets = [];
        for (let i = 0; i < snippets.length; i++) {
            if (!snippets[i].getAttribute("dirty")) {
                nonDirtySnippets.push(snippets[i]);
            }
            else {
                return;
            }
        }
        if (nonDirtySnippets.length === 0)
            return;
        for (let i = 0; i < nonDirtySnippets.length; i++) {
            const code = nonDirtySnippets[i].getElementsByTagName('code')[0].innerText;
            const t = nonDirtySnippets[i].getElementsByTagName('code')[0].classList;
            let codeName = "";
            for (let i = 0; i < t.length; i++) {
                if (t[i] !== "hljs") {
                    codeName = t[i].split("-")[1];
                    if (codeName === "undefined")
                        codeName = "";
                }
            }
            const snippetHeaderTemplate = `<div class="pre-header"><span>${codeName}</span><button class="hljs-copy"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" class="icon-sm"><path fill="currentColor" fill-rule="evenodd" d="M7 5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-2v2a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h2zm2 2h5a3 3 0 0 1 3 3v5h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1zM5 9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1z" clip-rule="evenodd"></path></svg>Copy code</button></div>`;
            const buttonIdle = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" class="icon-sm"><path fill="currentColor" fill-rule="evenodd" d="M7 5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-2v2a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h2zm2 2h5a3 3 0 0 1 3 3v5h2a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-9a1 1 0 0 0-1 1zM5 9a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1z" clip-rule="evenodd"></path></svg>Copy code`;
            const buttonOn = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" id="checkmark" class="icon-sm"><g><g><rect width="24" height="24" opacity="0"></rect><path fill="currentColor" fill-rule="evenodd" d="M9.86 18a1 1 0 0 1-.73-.32l-4.86-5.17a1 1 0 1 1 1.46-1.37l4.12 4.39 8.41-9.2a1 1 0 1 1 1.48 1.34l-9.14 10a1 1 0 0 1-.73.33z" clip-rule="evenodd"></path></g></g></svg>Copied!`;
            nonDirtySnippets[i].innerHTML = snippetHeaderTemplate + nonDirtySnippets[i].innerHTML;
            nonDirtySnippets[i].querySelector('.hljs-copy').addEventListener("click", function (e) {
                //e.target.innerText = 'Copying..';
                navigator.clipboard.writeText(code);
                e.currentTarget.innerHTML = buttonOn;
                e.currentTarget.disable();
                const button = e.currentTarget;
                setTimeout(function () {
                    button.innerHTML = buttonIdle;
                    button.enable();
                }, 2000);
            });
            nonDirtySnippets[i].setAttribute("dirty", "");
        }
    }
    async function getAllTextFromPDF() {
        if (!pdfDocument)
            return;
        let pageTexts = Array.from({ length: totalPageNumber }, async (v, i) => {
            return (await (await pdfDocument.getPage(i + 1)).getTextContent()).items.map(token => token.str).join('');
        });
        return (await Promise.all(pageTexts)).join(' ');
    }
    function cosineSimilarity(array1, array2) {
        const dotProduct = math.dot(array1, array2);
        const normA = math.norm(array1);
        const normB = math.norm(array2);
        const cosineSimilarity = dotProduct / (normA * normB);
        return cosineSimilarity;
    }
    function cosineDifference(array1, array2) {
        return 1 - cosineSimilarity(array1, array2);
    }
    function sortBySimilarity(embedding, textsWithEmbeddings, topK) {
        return textsWithEmbeddings
            .map((textWithEmbedding) => {
            const similarity = cosineSimilarity(embedding, textWithEmbedding.embedding);
            return { text: textWithEmbedding.text, similarity };
        })
            .sort((a, b) => b.similarity - a.similarity).slice(0, topK);
    }
    async function getEmbedding(message) {
        const apiKey = app["embeddings"]["apiKey"]["openai"];
        const model = currentEmbeddingModel;
        if (model != app["embeddings"]["model"]) {
            console.log(app["embeddings"]["model"], "but the conversation created using ", model, "switching to", model);
        }
        if (!apiKey || !model) {
            console.error("set fields");
            return;
        }
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", "https://api.openai.com/v1/embeddings", true);
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);
            xhr.onload = (e) => {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data.data[0].embedding);
                }
                catch (e) {
                    console.error(e);
                    reject(e);
                }
            };
            xhr.onreadystatechange = () => {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    const status = xhr.status;
                    if (status === 0 || (status >= 200 && status < 400)) {
                        console.log("DONE XHR");
                    }
                    else {
                        reject(`Error processing embedding creation (XHR readyState ${xhr.readyState}, status ${xhr.status}).`);
                    }
                }
            };
            xhr.onerror = (event) => {
                reject(`Error processing embedding creation (XHR readyState ${xhr.readyState}, status ${xhr.status}).`);
            };
            xhr.send(JSON.stringify({
                "model": model,
                "input": message,
            }));
        });
    }
    async function getEmbeddings() {
        const BATCH_SIZE = 512;
        const OVERLAP_SIZE = 100;
        const apiKey = app["embeddings"]["apiKey"]["openai"];
        const model = app["embeddings"]["model"];
        if (!apiKey || !model) {
            console.error("set fields");
            return;
        }
        const pdfText = await getAllTextFromPDF();
        const lengthOfText = pdfText.length;
        let embeddings = [];
        let promises = [];
        for (let i = 0; i < pdfText.length; i += BATCH_SIZE) {
            const promis = new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("POST", "https://api.openai.com/v1/embeddings", true);
                xhr.setRequestHeader("Content-Type", "application/json");
                xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);
                let last_response_len = 0;
                let overlappedX = i;
                let overlappedY = BATCH_SIZE;
                if (i > OVERLAP_SIZE) {
                    overlappedX -= OVERLAP_SIZE;
                }
                if (i + OVERLAP_SIZE < lengthOfText) {
                    overlappedY += OVERLAP_SIZE;
                }
                let currentText = pdfText.substr(overlappedX, overlappedY);
                xhr.onload = (e) => {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve({
                            "embedding": data.data[0].embedding,
                            "text": currentText
                        });
                    }
                    catch (e) {
                        console.error(e);
                        reject(e);
                    }
                };
                xhr.onreadystatechange = () => {
                    if (xhr.readyState === XMLHttpRequest.DONE) {
                        const status = xhr.status;
                        if (status === 0 || (status >= 200 && status < 400)) {
                            console.log("DONE XHR");
                        }
                        else {
                            reject(`Error processing embedding creation (XHR readyState ${xhr.readyState}, status ${xhr.status}).`);
                        }
                    }
                };
                xhr.onerror = (event) => {
                    reject(`Error processing embedding creation (XHR readyState ${xhr.readyState}, status ${xhr.status}).`);
                };
                xhr.send(JSON.stringify({
                    "model": model,
                    "input": currentText
                }));
            });
            //promise end
            promises.push(promis);
            //for end
        }
        try {
            const allEmbeddings = await Promise.all(promises);
            currentEmbeddings = allEmbeddings;
            const tx = db.transaction('conversations', 'readwrite');
            const convos = tx.objectStore("conversations");
            let path = openedFromUrl ? openedUrlLink : fileName;
            convos.get(path).onsuccess = (e) => {
                if (e.target.result !== undefined) {
                    const test = e.target.result;
                    test.embeddings = allEmbeddings;
                    convos.put(test);
                    console.log("successfully created embeddings");
                }
            };
        }
        catch (e) {
            console.error(e);
        }
    }
    const isDev = window.location.hostname === "localhost";
    if (isDev) {
        const ws = new WebSocket("ws://localhost:3001");
        ws.addEventListener("message", async (event) => {
            if (event.data === "reload") {
                console.log("Reloading Window");
                window.location.reload();
            }
        });
    }
})();
