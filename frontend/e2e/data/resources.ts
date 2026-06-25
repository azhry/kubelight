export const samplePods = [
  {
    kind: "pods",
    name: "nginx-frontend",
    namespace: "default",
    api_version: "v1",
    age: "3d",
    status: "Running",
  },
  {
    kind: "pods",
    name: "api-server",
    namespace: "default",
    api_version: "v1",
    age: "7d",
    status: "Running",
  },
  {
    kind: "pods",
    name: "redis-cache",
    namespace: "default",
    api_version: "v1",
    age: "1h",
    status: "Running",
  },
  {
    kind: "pods",
    name: "pending-job",
    namespace: "staging",
    api_version: "v1",
    age: "5m",
    status: "Pending",
  },
  {
    kind: "pods",
    name: "crash-loop-backoff",
    namespace: "default",
    api_version: "v1",
    age: "2d",
    status: "CrashLoopBackOff",
  },
];

export const sampleDeployments = [
  {
    kind: "deployments",
    name: "api",
    namespace: "default",
    api_version: "apps/v1",
    age: "7d",
    status: "3/3",
  },
  {
    kind: "deployments",
    name: "web",
    namespace: "default",
    api_version: "apps/v1",
    age: "14d",
    status: "2/2",
  },
];

export const sampleServices = [
  {
    kind: "services",
    name: "api-svc",
    namespace: "default",
    api_version: "v1",
    age: "7d",
    status: "ClusterIP",
  },
  {
    kind: "services",
    name: "web-svc",
    namespace: "default",
    api_version: "v1",
    age: "14d",
    status: "LoadBalancer",
  },
];

export const sampleNodes = [
  {
    kind: "nodes",
    name: "minikube",
    namespace: "",
    api_version: "v1",
    age: "30d",
    status: "True",
  },
];

export const sampleKubeconfigSessions = [
  {
    id: "session-1",
    label: "minikube",
    path: "C:\\Users\\dev\\.kube\\config",
    active: true,
  },
  {
    id: "session-2",
    label: "prod-cluster",
    path: "C:\\Users\\dev\\.kube\\prod-config",
    active: false,
  },
];

export const samplePodYaml = `apiVersion: v1
kind: Pod
metadata:
  name: nginx-frontend
  namespace: default
  labels:
    app: nginx
spec:
  containers:
    - name: nginx
      image: nginx:1.25
      ports:
        - containerPort: 80
`;

export const sampleDeploymentYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
        - name: api
          image: api:latest
          ports:
            - containerPort: 8080
`;
